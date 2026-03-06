#!/usr/bin/env node
/**
 * WBC per-at-bat broadcaster (MLB StatsAPI).
 * Poll frequently, but only prints when a NEW completed plate appearance appears.
 * Output style: SportsV-like.
 */

import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_GAME_PK = '788120';
const SPORT_ID_WBC = 51;
const TZ = 'Asia/Taipei';

function feedUrl(gamePk) {
  return `https://statsapi.mlb.com/api/v1.1/game/${encodeURIComponent(gamePk)}/feed/live`;
}

const STATE_DIR = path.join(process.cwd(), 'state');
function statePath(gamePk) {
  return path.join(STATE_DIR, `wbc_live_${gamePk}_atbat.json`);
}

function readState(gamePk) {
  try {
    return JSON.parse(fs.readFileSync(statePath(gamePk), 'utf8'));
  } catch {
    return {
      lastEndTime: null,
      lastHalf: null,
      lastInning: null,
      lastAwayR: null,
      lastHomeR: null,
      finished: false,
      gamePk,
    };
  }
}

function writeState(gamePk, st) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(statePath(gamePk), JSON.stringify({ ...st, gamePk }, null, 2));
}

function taipeiYmd(d = new Date()) {
  // sv-SE -> YYYY-MM-DD
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function isCTTeamName(name) {
  return name === 'Chinese Taipei' || /chinese\s*taipei/i.test(name || '');
}

function gameStateRank(detailedState = '') {
  const s = String(detailedState || '').toLowerCase();
  // Prefer live game, then warmup, then scheduled/preview, then final.
  if (s.includes('in progress') || s === 'in progress') return 0;
  if (s.includes('warmup')) return 1;
  if (s.includes('scheduled') || s.includes('preview') || s.includes('pre-game')) return 2;
  if (s.includes('final') || s.includes('completed') || s.includes('game over')) return 9;
  return 5;
}

async function resolveGamePk() {
  if (process.env.WBC_GAME_PK) return String(process.env.WBC_GAME_PK);

  const date = taipeiYmd();
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=${SPORT_ID_WBC}&date=${encodeURIComponent(date)}`;
  const j = await fetchJson(url);
  const games = (j?.dates || []).flatMap(x => x?.games || []);

  const ctGames = games
    .filter(g => isCTTeamName(g?.teams?.away?.team?.name) || isCTTeamName(g?.teams?.home?.team?.name))
    .map(g => ({
      gamePk: String(g?.gamePk),
      detailedState: g?.status?.detailedState || '',
      gameDate: g?.gameDate || '',
      away: g?.teams?.away?.team?.name,
      home: g?.teams?.home?.team?.name,
    }))
    .filter(g => g.gamePk && g.gamePk !== 'undefined');

  if (!ctGames.length) return DEFAULT_GAME_PK;

  ctGames.sort((a, b) => {
    const ra = gameStateRank(a.detailedState);
    const rb = gameStateRank(b.detailedState);
    if (ra !== rb) return ra - rb;
    const ta = a.gameDate ? new Date(a.gameDate).getTime() : 0;
    const tb = b.gameDate ? new Date(b.gameDate).getTime() : 0;
    return ta - tb;
  });

  return ctGames[0].gamePk || DEFAULT_GAME_PK;
}

function halfZh(half) {
  return half === 'top' ? '上' : half === 'bottom' ? '下' : '';
}

function basesStr(off) {
  const bases = [];
  if (off?.first) bases.push('一壘');
  if (off?.second) bases.push('二壘');
  if (off?.third) bases.push('三壘');
  if (bases.length === 3) return '滿壘';
  return bases.length ? bases.join('、') : '無人';
}

function zhDesc(res) {
  const event = (res?.event || '').toLowerCase();
  const desc = res?.description || '';

  // Prefer translating the structured event when possible.
  const byEvent = {
    strikeout: '三振出局',
    walk: '四壞保送',
    'hit by pitch': '觸身球保送',
    home_run: '全壘打',
    single: '一壘安打',
    double: '二壘安打',
    triple: '三壘安打',
    groundout: '滾地球出局',
    flyout: '外野飛球出局',
    lineout: '平飛球出局',
    pop_out: '內野飛球出局',
    popout: '內野飛球出局',
  };
  if (byEvent[event]) return byEvent[event];

  // Fallback: lightly translate common English patterns in the description.
  const d = desc;
  if (!d) return res?.event || '';
  if (/strikes out swinging/i.test(d)) return '揮棒落空三振出局';
  if (/strikes out looking/i.test(d)) return '見三振出局';
  if (/walks\.?$/i.test(d) || /walks\b/i.test(d)) return '四壞保送';
  if (/hit by pitch/i.test(d)) return '觸身球保送';
  if (/homers?/i.test(d) || /home run/i.test(d)) return '全壘打';
  if (/singles?/i.test(d)) return '一壘安打';
  if (/doubles?/i.test(d)) return '二壘安打';
  if (/triples?/i.test(d)) return '三壘安打';
  if (/grounds out/i.test(d)) return '滾地球出局';
  if (/lines out/i.test(d)) return '平飛球出局';
  if (/pops out/i.test(d)) return '內野飛球出局';
  if (/flies out/i.test(d)) {
    if (/in foul territory/i.test(d)) return '界外飛球出局';
    return '外野飛球出局';
  }

  // As a last resort, return the raw description.
  return d;
}

function baseStrFromPlay(play) {
  const ends = new Set();
  for (const r of play?.runners || []) {
    const mv = r?.movement;
    if (!mv || mv.isOut) continue;
    const end = mv.end;
    if (end === '1B' || end === '2B' || end === '3B') ends.add(end);
  }
  const has1 = ends.has('1B');
  const has2 = ends.has('2B');
  const has3 = ends.has('3B');
  if (has1 && has2 && has3) return '滿壘';
  if (has1 && has2) return '一、二壘';
  if (has1 && has3) return '一、三壘';
  if (has2 && has3) return '二、三壘';
  if (has1) return '一壘';
  if (has2) return '二壘';
  if (has3) return '三壘';
  return '無人';
}

const CT_NAME_MAP = {
  // Batters (WBC Chinese Taipei)
  'Stuart Fairchild': '費爾柴德',
  'An-Ko Lin': '林安可',
  'Chieh-Hsien Chen': '陳傑憲',
  'Yu Chang': '張育成',
  'Nien-Ting Wu': '吳念庭',
  'Kun-Yu Chiang': '江坤宇',
  'Tzu-Wei Lin': '林子偉',
  'Shao-Hung Chiang': '蔣少宏',
  'Chen-Wei Chen': '陳晨威',
  'Cheng-Hui Sung': '宋晟睿',
  // Pitchers (if they ever appear as batters, rare)
  'Jo-Hsi Hsu': '徐若熙',
  'Po-Yu Chen': '陳柏毓',
  'Yi-Lei Sun': '孫易磊',
};

function toZhName(name) {
  return CT_NAME_MAP[name] || name;
}

const TEAM_ZH_MAP = {
  'Chinese Taipei': '中華隊',
  Australia: '澳洲隊',
  Japan: '日本隊',
  Czechia: '捷克隊',
  'South Korea': '南韓隊',
  Korea: '南韓隊',
};

// 對手姓名翻譯（StatsAPI 通常只有英文名；能翻譯就靠這張表）
// 預設會嘗試從 workspace/data/wbc_opp_name_map.json 載入，沒找到就退回空表。
let OPP_NAME_MAP = {};
try {
  const p = path.join(process.cwd(), 'data', 'wbc_opp_name_map.json');
  OPP_NAME_MAP = JSON.parse(fs.readFileSync(p, 'utf8')) || {};
} catch {
  OPP_NAME_MAP = {};
}

function teamZhName(teamName) {
  return TEAM_ZH_MAP[teamName] || teamName;
}

function isChineseTaipei(teamName) {
  return teamName === 'Chinese Taipei' || /chinese\s*taipei/i.test(teamName || '');
}

function toOppZhName(name) {
  return OPP_NAME_MAP[name] || name;
}

function fmtScore(awayName, awayR, homeR, homeName) {
  return `（比分：${awayName} ${awayR}：${homeR} ${homeName}）`;
}

function playScore(play) {
  const ar = play?.result?.awayScore;
  const hr = play?.result?.homeScore;
  if (typeof ar === 'number' && typeof hr === 'number') return { awayR: ar, homeR: hr };
  return null;
}

function fmtLine(play, awayName, homeName, scoreSuffix = '') {
  const about = play?.about;
  const res = play?.result;
  const batterNameEn = play?.matchup?.batter?.fullName || '打者';
  const half = (about?.halfInning || '').toLowerCase();
  const battingTeam = half === 'top' ? awayName : half === 'bottom' ? homeName : '';

  // 顯示規則（最新版）：
  // - 中華隊打擊：顯示「中華隊 + 打者繁中名」
  // - 對手打擊：顯示「對手隊名 + 打者名（可翻中就翻；否則英文）」
  const isCT = isChineseTaipei(battingTeam);

  let prefix;
  if (isCT) {
    const batterNameZh = toZhName(batterNameEn);
    prefix = `${teamZhName('Chinese Taipei')} ${batterNameZh}`;
  } else {
    const oppTeam = teamZhName(battingTeam);
    const oppBatter = toOppZhName(batterNameEn);
    prefix = `${oppTeam} ${oppBatter}`;
  }

  const outs = play?.count?.outs;
  const baseStr = baseStrFromPlay(play);
  const tail = (outs != null) ? `（${outs}出局｜${baseStr}）` : `（${baseStr}）`;

  return `${prefix}：${zhDesc(res)}${tail}${scoreSuffix}`;
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'openclaw-wbc-atbat/0.1', accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const gamePk = await resolveGamePk();
  const st = readState(gamePk);
  const j = await fetchJson(feedUrl(gamePk));

  const status = j?.gameData?.status?.detailedState || '';
  const abstract = j?.gameData?.status?.abstractGameState || '';

  // Not started
  if (abstract === 'Preview' || status === 'Scheduled' || status === 'Warmup') {
    process.stdout.write('NO_REPLY\n');
    return;
  }

  // Final
  const isFinal = abstract === 'Final' || status.toLowerCase().includes('final');
  if (isFinal && st.finished) {
    process.stdout.write('NO_REPLY\n');
    return;
  }

  const linescore = j?.liveData?.linescore;
  const awayName = j?.gameData?.teams?.away?.name || '客隊';
  const homeName = j?.gameData?.teams?.home?.name || '主隊';
  const awayR = linescore?.teams?.away?.runs ?? 0;
  const homeR = linescore?.teams?.home?.runs ?? 0;

  // track score changes for notifications
  let prevAwayR = (typeof st.lastAwayR === 'number') ? st.lastAwayR : awayR;
  let prevHomeR = (typeof st.lastHomeR === 'number') ? st.lastHomeR : homeR;

  const inning = linescore?.currentInning;
  const half = (linescore?.inningHalf || '').toLowerCase();

  const allPlays = j?.liveData?.plays?.allPlays || [];
  const completed = allPlays.filter(p => p?.about?.isComplete);

  // Find new completed plays since last endTime
  let newPlays = [];
  if (st.lastEndTime) {
    const lastT = new Date(st.lastEndTime).getTime();
    newPlays = completed.filter(p => new Date(p.about.endTime).getTime() > lastT);
  } else {
    // first run: 為了避免「看起來沒推送」，只補最後 1 個完成打席（不倒整段歷史）
    if (!completed.length) {
      process.stdout.write('NO_REPLY\n');
      return;
    }
    const lastPlay = completed[completed.length - 1];
    const pInning = lastPlay.about.inning;
    const pHalf = (lastPlay.about.halfInning || '').toLowerCase();

    const out = [];
    out.push(`【${pInning}局${halfZh(pHalf)}】${awayName} ${awayR}：${homeR} ${homeName}`);
    // first run: include score header already, so no need to append score suffix
    out.push(fmtLine(lastPlay, awayName, homeName));

    const lastEndTime = lastPlay.about.endTime;
    const ps = playScore(lastPlay);
    writeState(gamePk, {
      lastEndTime,
      lastHalf: pHalf,
      lastInning: pInning,
      lastAwayR: ps?.awayR ?? awayR,
      lastHomeR: ps?.homeR ?? homeR,
      finished: false,
    });

    process.stdout.write(out.join('\n') + '\n');
    return;
  }

  // 半局剛開始但還沒結束任何打席：先推送半局標題（更有感）
  if (newPlays.length === 0) {
    const outs = linescore?.outs ?? null;
    if ((st.lastHalf !== half || st.lastInning !== inning) && outs === 0) {
      const out = [`【${inning}局${halfZh(half)}】${awayName} ${awayR}：${homeR} ${homeName}`];
      // 不更新 lastEndTime，避免漏掉真正的新打席
      writeState(gamePk, { ...st, lastHalf: half, lastInning: inning, finished: isFinal ? true : false });
      process.stdout.write(out.join('\n') + '\n');
      return;
    }

    if (isFinal && !st.finished) {
      process.stdout.write(`【終場】${awayName} ${awayR}：${homeR} ${homeName}\n`);
      writeState(gamePk, { ...st, finished: true, lastHalf: half, lastInning: inning });
      return;
    }

    process.stdout.write('NO_REPLY\n');
    return;
  }

  const out = [];
  // If inning/half changed since last message, emit header (以第一個新打席所屬局半為準)
  const firstPlay = newPlays[0];
  const pInning = firstPlay.about.inning;
  const pHalf = (firstPlay.about.halfInning || '').toLowerCase();
  if (st.lastHalf !== pHalf || st.lastInning !== pInning) {
    out.push(`【${pInning}局${halfZh(pHalf)}】${awayName} ${awayR}：${homeR} ${homeName}`);
  }

  // Emit each completed PA line; if this PA changes score, append current score
  for (const p of newPlays) {
    const ps = playScore(p);
    let suffix = '';
    if (ps && (ps.awayR !== prevAwayR || ps.homeR !== prevHomeR)) {
      suffix = fmtScore(awayName, ps.awayR, ps.homeR, homeName);
      prevAwayR = ps.awayR;
      prevHomeR = ps.homeR;
    }
    out.push(fmtLine(p, awayName, homeName, suffix));
  }

  // Update state to latest completed
  const lastCompleted = completed[completed.length - 1];
  const lastEndTime = lastCompleted.about.endTime;
  const lastPs = playScore(lastCompleted);
  writeState(gamePk, {
    lastEndTime,
    lastHalf: pHalf,
    lastInning: pInning,
    lastAwayR: lastPs?.awayR ?? awayR,
    lastHomeR: lastPs?.homeR ?? homeR,
    finished: isFinal ? true : false,
  });

  process.stdout.write(out.join('\n') + '\n');
}

main().catch(() => {
  process.stdout.write('NO_REPLY\n');
  process.exit(0);
});
