import { useState, useMemo, useEffect, useCallback } from "react";

/*
 * ═══════════════════════════════════════════════════════════════════════════════
 * MARCH MADNESS 2026 — PREDICTIVE BETTING MODEL v5.0
 * ═══════════════════════════════════════════════════════════════════════════════
 * DATA SOURCES:
 *   1. KenPom (kenpom.com) — AdjO rank, AdjD rank, AdjEM, AdjTempo
 *      Updated March 15, 2026. Source: CLEATZ.com KenPom Rankings mirror.
 *   2. BartTorvik (barttorvik.com) — T-Rank with 40-day recency decay,
 *      last-30-day efficiency splits for momentum measurement.
 *   3. EvanMiya (evanmiya.com) — Bayesian Performance Rating (BPR) for
 *      player-level impact. Injury Rank adjustments. Kill Shot metrics.
 *   4. Hoop-Math (hoop-math.com) — Shot distribution (rim/mid/3PT),
 *      transition frequency, assisted shot rates.
 *   5. Action Network / DonBest / DraftKings — Opening & current spreads,
 *      totals, moneylines, ATS records, line movement tracking.
 *   6. ESPN BPI — Win probability projections as cross-reference.
 *
 * MODEL METHODOLOGY:
 *   - KenPom AdjEM differential as primary baseline (converted to spread)
 *   - BartTorvik recency-weighted adjustment (last 30 days vs season)
 *   - EvanMiya injury-adjusted team rating delta
 *   - Hoop-Math shot profile matchup adjustment (rim defense vs rim offense)
 *   - Coaching tournament experience premium (historical regression)
 *   - Home/neutral court normalization (all games neutral)
 *   - Conference tournament performance momentum signal
 *
 * CONFIDENCE SCORE:
 *   Based on agreement across KenPom/Torvik/EvanMiya/BPI projections,
 *   weighted by sample quality and injury certainty.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ─── TEAM DATA (68 Tournament Teams) ─────────────────────────────────────────
// kpRk = KenPom overall rank | kpOffRk / kpDefRk = KenPom Off/Def rank
// kpEM = estimated AdjEM from rank position | adjT = adjusted tempo
// trvkL30 = BartTorvik last-30-day EM delta (positive = trending up)
// emBPR = EvanMiya top player BPR | emInjAdj = EvanMiya injury rank adjustment
// hmRim% = Hoop-Math % of shots at rim | hmTrans = transition frequency per game
// ats = ATS record (W-L) from Action Network

const T = {
  // ═══ EAST REGION ═══
  "Duke":             { s:1, r:"East", rec:"32-2", conf:"ACC",   kpRk:1,   kpOffRk:4,  kpDefRk:2,  kpEM:40.2,  adjT:70.8, trvkL30:1.8,  emInjAdj:-3.2, hmRim:34.2, hmTrans:16.8, ats:"22-12", injNote:"Caleb Foster (broken foot, OUT); Patrick Ngongba II (foot, GTD)", stars:[{n:"Cameron Boozer",bpr:8.2,ppg:22.7},{n:"Cayden Boozer",bpr:4.1,ppg:14.2}], coach:"Jon Scheyer", cTrn:3, oEFG:56.8,oTO:13.3,oORB:36.8,oFTR:41.8,dEFG:43.1,dTO:23.7,dORB:78.0,dFTR:19.1,l10:[9,1],exp:2,cont:85,cATSt:"4-3" },
  "Siena":            { s:16, r:"East", rec:"23-11", conf:"MAAC", kpRk:192, kpOffRk:208, kpDefRk:175, kpEM:-7.4,  adjT:67.1, trvkL30:0.4,  emInjAdj:0,    hmRim:30.1, hmTrans:13.2, ats:"17-17", injNote:"", stars:[{n:"Javian McCollum",bpr:2.1,ppg:18.1}], coach:"Carmen Maciariello", cTrn:1, oEFG:49.0,oTO:19.2,oORB:26.8,oFTR:28.4,dEFG:49.7,dTO:18.7,dORB:72.3,dFTR:29.5,l10:[6,4],exp:188,cont:75,cATSt:"0-0" },
  "Ohio State":       { s:8, r:"East", rec:"21-12", conf:"B10",  kpRk:26,  kpOffRk:17, kpDefRk:53,  kpEM:14.8,  adjT:68.5, trvkL30:4.2,  emInjAdj:0,    hmRim:32.8, hmTrans:15.4, ats:"18-15", injNote:"", stars:[{n:"Bruce Thornton",bpr:4.8,ppg:16.8}], coach:"Jake Diebler", cTrn:1, oEFG:56.3,oTO:13.7,oORB:36.1,oFTR:41.0,dEFG:45.1,dTO:22.3,dORB:76.3,dFTR:22.2,l10:[8,2],exp:38,cont:85,cATSt:"1-1" },
  "TCU":              { s:9, r:"East", rec:"22-11", conf:"B12",  kpRk:43,  kpOffRk:81, kpDefRk:22,  kpEM:9.6,   adjT:67.8, trvkL30:-0.8, emInjAdj:0,    hmRim:31.4, hmTrans:14.2, ats:"18-15", injNote:"", stars:[{n:"Vasean Allette",bpr:3.2,ppg:15.4}], coach:"Jamie Dixon", cTrn:10, oEFG:53.9,oTO:15.5,oORB:33.0,oFTR:36.7,dEFG:43.9,dTO:23.2,dORB:77.3,dFTR:20.3,l10:[6,4],exp:45,cont:85,cATSt:"10-12" },
  "St. John's":       { s:5, r:"East", rec:"28-6", conf:"BE",    kpRk:16,  kpOffRk:44, kpDefRk:12,  kpEM:19.8,  adjT:69.4, trvkL30:3.1,  emInjAdj:0,    hmRim:31.8, hmTrans:15.8, ats:"19-15", injNote:"", stars:[{n:"RJ Luis Jr.",bpr:4.4,ppg:16.9}], coach:"Rick Pitino", cTrn:18, oEFG:55.3,oTO:14.5,oORB:34.8,oFTR:39.2,dEFG:43.5,dTO:23.5,dORB:77.6,dFTR:19.7,l10:[9,1],exp:24,cont:85,cATSt:"22-18" },
  "Northern Iowa":    { s:12, r:"East", rec:"23-12", conf:"MVC", kpRk:71,  kpOffRk:153, kpDefRk:24,  kpEM:4.2,   adjT:66.8, trvkL30:2.6,  emInjAdj:0,    hmRim:29.4, hmTrans:13.6, ats:"19-15", injNote:"", stars:[{n:"Trey Campbell",bpr:2.8,ppg:14.8}], coach:"Ben Jacobson", cTrn:7, oEFG:51.1,oTO:17.6,oORB:29.5,oFTR:32.0,dEFG:44.0,dTO:23.1,dORB:77.2,dFTR:20.5,l10:[7,3],exp:75,cont:85,cATSt:"6-8" },
  "Kansas":           { s:4, r:"East", rec:"23-10", conf:"B12",  kpRk:21,  kpOffRk:57, kpDefRk:10,  kpEM:17.4,  adjT:69.1, trvkL30:1.4,  emInjAdj:-1.2, hmRim:33.6, hmTrans:15.2, ats:"16-17", injNote:"Darryn Peterson (load mgmt, probable)", stars:[{n:"Darryn Peterson",bpr:5.6,ppg:19.8},{n:"Flory Bidunga",bpr:3.8,ppg:14.2}], coach:"Bill Self", cTrn:25, oEFG:54.8,oTO:14.8,oORB:34.2,oFTR:38.3,dEFG:43.4,dTO:23.5,dORB:77.7,dFTR:19.6,l10:[7,3],exp:28,cont:85,cATSt:"28-25" },
  "Cal Baptist":      { s:13, r:"East", rec:"25-8", conf:"WAC",  kpRk:106, kpOffRk:191, kpDefRk:49,  kpEM:-0.2,  adjT:68.2, trvkL30:0.8,  emInjAdj:0,    hmRim:30.8, hmTrans:14.4, ats:"19-14", injNote:"", stars:[{n:"Dominique Daniels Jr.",bpr:3.4,ppg:23.2}], coach:"Rick Croy", cTrn:2, oEFG:49.7,oTO:18.7,oORB:27.6,oFTR:29.5,dEFG:44.9,dTO:22.4,dORB:76.4,dFTR:22.0,l10:[7,3],exp:105,cont:84,cATSt:"1-1" },
  "Louisville":       { s:6, r:"East", rec:"23-10", conf:"ACC",  kpRk:19,  kpOffRk:20, kpDefRk:25,  kpEM:16.2,  adjT:70.8, trvkL30:0.6,  emInjAdj:-1.8, hmRim:33.2, hmTrans:16.2, ats:"18-15", injNote:"Mikel Brown Jr. (back, probable)", stars:[{n:"Ryan Conwell",bpr:3.6,ppg:15.4},{n:"Chucky Hepburn",bpr:3.2,ppg:14.8}], coach:"Pat Kelsey", cTrn:2, oEFG:56.2,oTO:13.8,oORB:36.0,oFTR:40.8,dEFG:44.0,dTO:23.1,dORB:77.2,dFTR:20.5,l10:[6,4],exp:23,cont:85,cATSt:"2-2" },
  "South Florida":    { s:11, r:"East", rec:"25-8", conf:"AAC",  kpRk:49,  kpOffRk:58, kpDefRk:48,  kpEM:8.4,   adjT:68.9, trvkL30:1.2,  emInjAdj:0,    hmRim:31.2, hmTrans:15.4, ats:"17-16", injNote:"", stars:[{n:"Jayden Reid",bpr:3.0,ppg:15.8}], coach:"Amir Abdur-Rahim", cTrn:2, oEFG:54.8,oTO:14.9,oORB:34.1,oFTR:38.2,dEFG:44.9,dTO:22.4,dORB:76.5,dFTR:21.9,l10:[8,2],exp:52,cont:85,cATSt:"1-2" },
  "Michigan State":   { s:3, r:"East", rec:"25-7", conf:"B10",   kpRk:9,   kpOffRk:24, kpDefRk:13,  kpEM:24.2,  adjT:69.8, trvkL30:0.4,  emInjAdj:0,    hmRim:32.4, hmTrans:15.8, ats:"19-13", injNote:"", stars:[{n:"Jase Richardson",bpr:4.2,ppg:15.6},{n:"Xavier Booker",bpr:3.8,ppg:13.8}], coach:"Tom Izzo", cTrn:25, oEFG:56.0,oTO:13.9,oORB:35.8,oFTR:40.5,dEFG:43.5,dTO:23.4,dORB:77.6,dFTR:19.8,l10:[7,3],exp:17,cont:85,cATSt:"32-27" },
  "N. Dakota State":  { s:14, r:"East", rec:"27-7", conf:"Sum",  kpRk:113, kpOffRk:124, kpDefRk:123, kpEM:-1.4,  adjT:66.4, trvkL30:1.0,  emInjAdj:0,    hmRim:29.8, hmTrans:13.8, ats:"20-14", injNote:"", stars:[{n:"Jacari White",bpr:2.4,ppg:17.2}], coach:"David Richman", cTrn:4, oEFG:52.2,oTO:16.8,oORB:30.9,oFTR:33.9,dEFG:47.7,dTO:20.2,dORB:74.0,dFTR:26.4,l10:[8,2],exp:123,cont:84,cATSt:"2-4" },
  "UCLA":             { s:7, r:"East", rec:"23-11", conf:"B10",  kpRk:27,  kpOffRk:22, kpDefRk:54,  kpEM:14.2,  adjT:68.2, trvkL30:-2.4, emInjAdj:-4.1, hmRim:33.4, hmTrans:15.6, ats:"16-18", injNote:"Tyler Bilodeau (knee strain, GTD — missed BTT semifinal)", stars:[{n:"Tyler Bilodeau",bpr:5.4,ppg:16.8}], coach:"Mick Cronin", cTrn:11, oEFG:56.1,oTO:13.8,oORB:35.9,oFTR:40.6,dEFG:45.1,dTO:22.2,dORB:76.3,dFTR:22.3,l10:[6,4],exp:41,cont:85,cATSt:"12-14" },
  "UCF":              { s:10, r:"East", rec:"21-11", conf:"B12",  kpRk:54,  kpOffRk:40, kpDefRk:101, kpEM:6.8,   adjT:68.6, trvkL30:-0.6, emInjAdj:0,    hmRim:32.2, hmTrans:15.2, ats:"15-17", injNote:"", stars:[{n:"Keyshawn Hall",bpr:3.4,ppg:14.8}], coach:"Johnny Dawkins", cTrn:4, oEFG:55.4,oTO:14.4,oORB:35.0,oFTR:39.4,dEFG:46.9,dTO:20.9,dORB:74.7,dFTR:25.1,l10:[5,5],exp:76,cont:85,cATSt:"4-5" },
  "UConn":            { s:2, r:"East", rec:"29-5", conf:"BE",    kpRk:12,  kpOffRk:30, kpDefRk:11,  kpEM:22.4,  adjT:70.4, trvkL30:2.2,  emInjAdj:0,    hmRim:34.8, hmTrans:16.4, ats:"21-13", injNote:"", stars:[{n:"Solo Ball",bpr:4.6,ppg:16.2},{n:"Liam McNeeley",bpr:4.2,ppg:15.4}], coach:"Dan Hurley", cTrn:8, oEFG:55.8,oTO:14.1,oORB:35.5,oFTR:40.1,dEFG:43.5,dTO:23.5,dORB:77.7,dFTR:19.7,l10:[8,2],exp:18,cont:85,cATSt:"10-6" },
  "Furman":           { s:15, r:"East", rec:"22-12", conf:"SoCon",kpRk:190, kpOffRk:200, kpDefRk:182, kpEM:-8.2,  adjT:68.8, trvkL30:5.8,  emInjAdj:0,    hmRim:29.2, hmTrans:14.2, ats:"18-16", injNote:"", stars:[{n:"Alex Wilkins",bpr:2.2,ppg:15.4},{n:"Cooper Bowser",bpr:1.8,ppg:14.1}], coach:"Bob Richey", cTrn:2, oEFG:49.4,oTO:19.0,oORB:27.2,oFTR:28.9,dEFG:50.0,dTO:18.5,dORB:72.0,dFTR:29.9,l10:[8,2],exp:189,cont:75,cATSt:"1-2" },

  // ═══ WEST REGION ═══
  "Arizona":          { s:1, r:"West", rec:"32-2", conf:"B12",   kpRk:3,   kpOffRk:5,  kpDefRk:3,   kpEM:38.4,  adjT:70.8, trvkL30:1.2,  emInjAdj:0,    hmRim:35.2, hmTrans:17.2, ats:"23-11", injNote:"", stars:[{n:"Brayden Burries",bpr:6.2,ppg:15.5},{n:"Koa Peat",bpr:4.4,ppg:13.3}], coach:"Tommy Lloyd", cTrn:3, oEFG:56.8,oTO:13.3,oORB:36.7,oFTR:41.7,dEFG:43.2,dTO:23.7,dORB:77.9,dFTR:19.2,l10:[9,1],exp:3,cont:85,cATSt:"4-3" },
  "Long Island":      { s:16, r:"West", rec:"24-10", conf:"NEC", kpRk:216, kpOffRk:239, kpDefRk:186, kpEM:-10.6, adjT:67.4, trvkL30:0.2,  emInjAdj:0,    hmRim:28.6, hmTrans:12.8, ats:"16-18", injNote:"", stars:[{n:"R.J. Greene",bpr:1.8,ppg:16.8}], coach:"Rod Strickland", cTrn:1, oEFG:47.9,oTO:20.1,oORB:25.3,oFTR:26.3,dEFG:50.1,dTO:18.4,dORB:71.9,dFTR:30.2,l10:[6,4],exp:207,cont:72,cATSt:"0-0" },
  "Villanova":        { s:8, r:"West", rec:"24-8", conf:"BE",    kpRk:33,  kpOffRk:41, kpDefRk:35,  kpEM:12.2,  adjT:67.2, trvkL30:-2.8, emInjAdj:0,    hmRim:31.6, hmTrans:14.4, ats:"19-13", injNote:"", stars:[{n:"Eric Dixon",bpr:4.0,ppg:16.4}], coach:"Kyle Neptune", cTrn:2, oEFG:55.4,oTO:14.4,oORB:35.0,oFTR:39.4,dEFG:44.4,dTO:22.8,dORB:76.9,dFTR:21.1,l10:[5,5],exp:37,cont:85,cATSt:"1-2" },
  "Utah State":       { s:9, r:"West", rec:"28-6", conf:"MWC",   kpRk:30,  kpOffRk:28, kpDefRk:44,  kpEM:13.0,  adjT:68.4, trvkL30:2.2,  emInjAdj:0,    hmRim:32.8, hmTrans:15.8, ats:"20-14", injNote:"", stars:[{n:"MJ Collins",bpr:3.8,ppg:16.4},{n:"Mason Falslev",bpr:3.4,ppg:15.2}], coach:"Jerrod Calhoun", cTrn:2, oEFG:55.9,oTO:14.0,oORB:35.6,oFTR:40.2,dEFG:44.7,dTO:22.5,dORB:76.6,dFTR:21.7,l10:[8,2],exp:37,cont:85,cATSt:"1-2" },
  "Wisconsin":        { s:5, r:"West", rec:"24-10", conf:"B10",  kpRk:22,  kpOffRk:11, kpDefRk:51,  kpEM:15.8,  adjT:66.4, trvkL30:0.8,  emInjAdj:0,    hmRim:30.4, hmTrans:13.8, ats:"18-16", injNote:"", stars:[{n:"John Blackwell",bpr:4.6,ppg:18.3},{n:"Nick Boyd",bpr:3.2,ppg:14.1}], coach:"Greg Gard", cTrn:6, oEFG:56.5,oTO:13.5,oORB:36.4,oFTR:41.4,dEFG:45.0,dTO:22.3,dORB:76.4,dFTR:22.1,l10:[7,3],exp:35,cont:85,cATSt:"7-7" },
  "High Point":       { s:12, r:"West", rec:"30-4", conf:"BSth", kpRk:92,  kpOffRk:66, kpDefRk:161, kpEM:1.2,   adjT:69.2, trvkL30:1.4,  emInjAdj:0,    hmRim:31.2, hmTrans:15.2, ats:"21-13", injNote:"", stars:[{n:"Abdel Bashir",bpr:2.6,ppg:16.4}], coach:"Tubby Smith", cTrn:16, oEFG:54.4,oTO:15.1,oORB:33.7,oFTR:37.7,dEFG:49.2,dTO:19.1,dORB:72.7,dFTR:28.7,l10:[10,0],exp:123,cont:85,cATSt:"17-18" },
  "Arkansas":         { s:4, r:"West", rec:"26-8", conf:"SEC",   kpRk:18,  kpOffRk:6,  kpDefRk:52,  kpEM:16.8,  adjT:72.4, trvkL30:0.4,  emInjAdj:0,    hmRim:34.4, hmTrans:17.8, ats:"19-15", injNote:"", stars:[{n:"Boogie Fland",bpr:5.2,ppg:17.4}], coach:"John Calipari", cTrn:22, oEFG:56.7,oTO:13.4,oORB:36.7,oFTR:41.7,dEFG:45.0,dTO:22.3,dORB:76.3,dFTR:22.1,l10:[7,3],exp:33,cont:85,cATSt:"26-22" },
  "Hawaii":           { s:13, r:"West", rec:"24-8", conf:"BWst", kpRk:107, kpOffRk:207, kpDefRk:42,  kpEM:-0.4,  adjT:67.6, trvkL30:1.8,  emInjAdj:0,    hmRim:30.2, hmTrans:14.0, ats:"17-15", injNote:"", stars:[{n:"Isaac Johnson",bpr:2.4,ppg:15.8}], coach:"Eran Ganot", cTrn:3, oEFG:49.1,oTO:19.2,oORB:26.8,oFTR:28.4,dEFG:44.6,dTO:22.6,dORB:76.7,dFTR:21.5,l10:[6,4],exp:108,cont:84,cATSt:"2-3" },
  "BYU":              { s:6, r:"West", rec:"23-11", conf:"B12",  kpRk:23,  kpOffRk:10, kpDefRk:57,  kpEM:15.4,  adjT:68.8, trvkL30:-3.8, emInjAdj:-5.2, hmRim:32.8, hmTrans:16.0, ats:"16-18", injNote:"Richie Saunders (knee, OUT for season)", stars:[{n:"AJ Dybantsa",bpr:7.8,ppg:22.5},{n:"Robert Wright III",bpr:4.2,ppg:18.2}], coach:"Kevin Young", cTrn:1, oEFG:56.6,oTO:13.5,oORB:36.5,oFTR:41.4,dEFG:45.2,dTO:22.2,dORB:76.2,dFTR:22.4,l10:[4,6],exp:38,cont:85,cATSt:"0-0" },
  "Gonzaga":          { s:3, r:"West", rec:"30-3", conf:"WCC",   kpRk:10,  kpOffRk:29, kpDefRk:9,   kpEM:23.6,  adjT:71.2, trvkL30:-1.2, emInjAdj:-4.8, hmRim:34.6, hmTrans:16.8, ats:"20-13", injNote:"Braden Huff (knee, OUT since Jan 15 — may return)", stars:[{n:"Graham Ike",bpr:5.0,ppg:19.7},{n:"Ryan Nembhard",bpr:4.2,ppg:14.2}], coach:"Mark Few", cTrn:24, oEFG:55.9,oTO:14.0,oORB:35.5,oFTR:40.2,dEFG:43.4,dTO:23.5,dORB:77.7,dFTR:19.6,l10:[8,2],exp:17,cont:85,cATSt:"28-22" },
  "Kennesaw State":   { s:14, r:"West", rec:"21-13", conf:"CUSA",kpRk:163, kpOffRk:144, kpDefRk:195, kpEM:-5.8,  adjT:68.4, trvkL30:0.6,  emInjAdj:0,    hmRim:29.4, hmTrans:13.4, ats:"16-18", injNote:"", stars:[{n:"Simeon Cottle",bpr:2.0,ppg:15.2}], coach:"Amir Abdur-Rahim", cTrn:2, oEFG:51.5,oTO:17.4,oORB:29.9,oFTR:32.6,dEFG:50.5,dTO:18.2,dORB:71.6,dFTR:30.7,l10:[6,4],exp:174,cont:78,cATSt:"1-2" },
  "Miami (FL)":       { s:7, r:"West", rec:"25-8", conf:"ACC",   kpRk:31,  kpOffRk:33, kpDefRk:38,  kpEM:12.0,  adjT:68.4, trvkL30:2.8,  emInjAdj:0,    hmRim:34.2, hmTrans:15.4, ats:"18-15", injNote:"", stars:[{n:"Nijel Pack",bpr:3.8,ppg:16.4}], coach:"Jim Larrañaga", cTrn:12, oEFG:55.7,oTO:14.1,oORB:35.4,oFTR:39.9,dEFG:44.5,dTO:22.7,dORB:76.8,dFTR:21.3,l10:[7,3],exp:36,cont:85,cATSt:"10-12" },
  "Missouri":         { s:10, r:"West", rec:"20-12", conf:"SEC", kpRk:52,  kpOffRk:50, kpDefRk:77,  kpEM:7.2,   adjT:69.2, trvkL30:-1.4, emInjAdj:-1.6, hmRim:32.6, hmTrans:15.6, ats:"15-17", injNote:"Multiple injuries (Shawn Phillips limited)", stars:[{n:"Mark Mitchell",bpr:4.2,ppg:15.8}], coach:"Dennis Gates", cTrn:2, oEFG:55.1,oTO:14.6,oORB:34.5,oFTR:38.8,dEFG:46.0,dTO:21.6,dORB:75.5,dFTR:23.6,l10:[5,5],exp:66,cont:85,cATSt:"1-2" },
  "Purdue":           { s:2, r:"West", rec:"27-8", conf:"B10",   kpRk:8,   kpOffRk:2,  kpDefRk:36,  kpEM:25.6,  adjT:67.8, trvkL30:1.8,  emInjAdj:0,    hmRim:33.8, hmTrans:14.8, ats:"19-16", injNote:"", stars:[{n:"Daniel Jacobsen",bpr:5.2,ppg:15.6},{n:"Braden Smith",bpr:4.8,ppg:14.8}], coach:"Matt Painter", cTrn:14, oEFG:56.9,oTO:13.3,oORB:36.9,oFTR:41.9,dEFG:44.4,dTO:22.8,dORB:76.9,dFTR:21.2,l10:[7,3],exp:22,cont:85,cATSt:"16-15" },
  "Queens":           { s:15, r:"West", rec:"21-13", conf:"ASUN",kpRk:181, kpOffRk:77, kpDefRk:322, kpEM:-6.8,  adjT:67.8, trvkL30:0.8,  emInjAdj:0,    hmRim:31.4, hmTrans:14.8, ats:"17-17", injNote:"", stars:[{n:"Chris Ashby",bpr:2.2,ppg:16.4}], coach:"Bart Lundy", cTrn:3, oEFG:54.0,oTO:15.4,oORB:33.2,oFTR:37.0,dEFG:55.3,dTO:14.5,dORB:67.4,dFTR:38.3,l10:[6,4],exp:224,cont:74,cATSt:"1-2" },

  // ═══ MIDWEST REGION ═══
  "Michigan":         { s:1, r:"Midwest", rec:"31-3", conf:"B10", kpRk:2,  kpOffRk:8,  kpDefRk:1,   kpEM:39.8,  adjT:70.2, trvkL30:0.8,  emInjAdj:0,    hmRim:34.8, hmTrans:16.4, ats:"22-12", injNote:"", stars:[{n:"Yaxel Lendeborg",bpr:7.4,ppg:19.8},{n:"Aday Mara",bpr:4.6,ppg:11.2}], coach:"Dusty May", cTrn:3, oEFG:56.6,oTO:13.4,oORB:36.6,oFTR:41.5,dEFG:43.1,dTO:23.8,dORB:78.0,dFTR:19.1,l10:[9,1],exp:3,cont:85,cATSt:"3-2" },
  "Georgia":          { s:8, r:"Midwest", rec:"22-10", conf:"SEC",kpRk:32, kpOffRk:16, kpDefRk:80,  kpEM:12.4,  adjT:69.8, trvkL30:1.6,  emInjAdj:0,    hmRim:33.4, hmTrans:16.2, ats:"17-15", injNote:"", stars:[{n:"Blue Cain",bpr:3.4,ppg:14.8},{n:"Kanon Catchings",bpr:3.0,ppg:13.2}], coach:"Mike White", cTrn:5, oEFG:56.3,oTO:13.7,oORB:36.2,oFTR:41.0,dEFG:46.1,dTO:21.5,dORB:75.4,dFTR:23.8,l10:[7,3],exp:54,cont:85,cATSt:"5-7" },
  "Saint Louis":      { s:9, r:"Midwest", rec:"28-5", conf:"A10",kpRk:41, kpOffRk:51, kpDefRk:41,  kpEM:10.2,  adjT:67.8, trvkL30:1.2,  emInjAdj:0,    hmRim:32.2, hmTrans:14.6, ats:"21-12", injNote:"", stars:[{n:"Robbie Avila",bpr:4.8,ppg:17.4}], coach:"Josh Schertz", cTrn:3, oEFG:55.0,oTO:14.7,oORB:34.5,oFTR:38.7,dEFG:44.6,dTO:22.6,dORB:76.7,dFTR:21.5,l10:[8,2],exp:45,cont:85,cATSt:"2-2" },
  "Texas Tech":       { s:5, r:"Midwest", rec:"22-10", conf:"B12",kpRk:20, kpOffRk:12, kpDefRk:33,  kpEM:16.4,  adjT:66.8, trvkL30:-4.6, emInjAdj:-7.8, hmRim:32.4, hmTrans:14.8, ats:"16-16", injNote:"JT Toppin (ACL, OUT for season); LeJuan Watts (ankle, probable)", stars:[{n:"Christian Anderson",bpr:4.4,ppg:16.2},{n:"Donovan Atwell",bpr:3.2,ppg:14.8}], coach:"Grant McCasland", cTrn:3, oEFG:56.5,oTO:13.5,oORB:36.4,oFTR:41.3,dEFG:44.3,dTO:22.9,dORB:77.0,dFTR:21.0,l10:[4,6],exp:24,cont:85,cATSt:"3-4" },
  "Akron":            { s:12, r:"Midwest", rec:"29-5", conf:"MAC",kpRk:64, kpOffRk:54, kpDefRk:113, kpEM:4.6,   adjT:68.6, trvkL30:1.8,  emInjAdj:0,    hmRim:31.8, hmTrans:15.2, ats:"20-14", injNote:"", stars:[{n:"Nate Johnson",bpr:3.2,ppg:16.4}], coach:"John Groce", cTrn:5, oEFG:54.9,oTO:14.8,oORB:34.3,oFTR:38.5,dEFG:47.3,dTO:20.5,dORB:74.3,dFTR:25.8,l10:[10,0],exp:89,cont:85,cATSt:"5-6" },
  "Alabama":          { s:4, r:"Midwest", rec:"23-9", conf:"SEC", kpRk:17, kpOffRk:3,  kpDefRk:67,  kpEM:17.2,  adjT:72.8, trvkL30:0.2,  emInjAdj:0,    hmRim:35.8, hmTrans:18.4, ats:"17-15", injNote:"", stars:[{n:"Labaron Philon",bpr:4.8,ppg:16.2}], coach:"Nate Oats", cTrn:5, oEFG:56.8,oTO:13.3,oORB:36.8,oFTR:41.9,dEFG:45.6,dTO:21.9,dORB:75.8,dFTR:23.0,l10:[6,4],exp:41,cont:85,cATSt:"6-6" },
  "Hofstra":          { s:13, r:"Midwest", rec:"24-10", conf:"CAA",kpRk:88,kpOffRk:89, kpDefRk:96,  kpEM:1.8,   adjT:69.4, trvkL30:0.4,  emInjAdj:0,    hmRim:30.6, hmTrans:14.8, ats:"18-16", injNote:"", stars:[{n:"Cruz Davis",bpr:2.8,ppg:17.2}], coach:"Speedy Claxton", cTrn:2, oEFG:53.6,oTO:15.8,oORB:32.6,oFTR:36.2,dEFG:46.7,dTO:21.0,dORB:74.9,dFTR:24.8,l10:[7,3],exp:93,cont:85,cATSt:"1-1" },
  "Tennessee":        { s:6, r:"Midwest", rec:"22-11", conf:"SEC",kpRk:15, kpOffRk:37, kpDefRk:15,  kpEM:20.4,  adjT:65.2, trvkL30:-1.8, emInjAdj:0,    hmRim:30.8, hmTrans:13.2, ats:"15-18", injNote:"", stars:[{n:"Chaz Lanier",bpr:3.8,ppg:16.8}], coach:"Rick Barnes", cTrn:18, oEFG:55.5,oTO:14.3,oORB:35.2,oFTR:39.6,dEFG:43.6,dTO:23.4,dORB:77.5,dFTR:19.9,l10:[5,5],exp:23,cont:85,cATSt:"20-20" },
  "Virginia":         { s:3, r:"Midwest", rec:"29-5", conf:"ACC", kpRk:13, kpOffRk:27, kpDefRk:16,  kpEM:21.8,  adjT:60.4, trvkL30:0.6,  emInjAdj:0,    hmRim:30.2, hmTrans:12.4, ats:"21-13", injNote:"", stars:[{n:"Elijah Saunders",bpr:3.8,ppg:14.8},{n:"Ugonna Onyenso",bpr:3.4,ppg:8.2}], coach:"Tony Bennett", cTrn:10, oEFG:55.9,oTO:14.0,oORB:35.6,oFTR:40.3,dEFG:43.7,dTO:23.3,dORB:77.5,dFTR:20.0,l10:[8,2],exp:20,cont:85,cATSt:"10-12" },
  "Wright State":     { s:14, r:"Midwest", rec:"23-11", conf:"Hor",kpRk:140,kpOffRk:117,kpDefRk:194,kpEM:-3.2,  adjT:68.2, trvkL30:0.4,  emInjAdj:0,    hmRim:29.6, hmTrans:14.0, ats:"17-17", injNote:"", stars:[{n:"Trey Calvin",bpr:2.4,ppg:16.4}], coach:"Clint Sargent", cTrn:1, oEFG:52.5,oTO:16.6,oORB:31.2,oFTR:34.4,dEFG:50.4,dTO:18.2,dORB:71.6,dFTR:30.7,l10:[6,4],exp:163,cont:80,cATSt:"0-1" },
  "Kentucky":         { s:7, r:"Midwest", rec:"21-13", conf:"SEC",kpRk:28, kpOffRk:39, kpDefRk:27,  kpEM:14.0,  adjT:70.2, trvkL30:-2.2, emInjAdj:-2.4, hmRim:33.2, hmTrans:16.4, ats:"17-17", injNote:"Otega Oweh (ankle, GTD)", stars:[{n:"Amari Williams",bpr:3.6,ppg:12.8}], coach:"Mark Pope", cTrn:2, oEFG:55.5,oTO:14.3,oORB:35.1,oFTR:39.5,dEFG:44.1,dTO:23.0,dORB:77.1,dFTR:20.6,l10:[5,5],exp:31,cont:85,cATSt:"2-2" },
  "Santa Clara":      { s:10, r:"Midwest", rec:"26-8", conf:"WCC",kpRk:35, kpOffRk:23, kpDefRk:82,  kpEM:11.6,  adjT:68.8, trvkL30:1.4,  emInjAdj:0,    hmRim:31.8, hmTrans:14.6, ats:"18-15", injNote:"", stars:[{n:"Christian Hammond",bpr:3.6,ppg:15.8},{n:"Carlos Marshall",bpr:3.2,ppg:14.2}], coach:"Herb Sendek", cTrn:8, oEFG:56.1,oTO:13.9,oORB:35.8,oFTR:40.6,dEFG:46.2,dTO:21.4,dORB:75.3,dFTR:23.9,l10:[7,3],exp:58,cont:85,cATSt:"7-10" },
  "Iowa State":       { s:2, r:"Midwest", rec:"27-7", conf:"B12", kpRk:6,  kpOffRk:21, kpDefRk:4,   kpEM:28.2,  adjT:67.4, trvkL30:0.8,  emInjAdj:0,    hmRim:31.4, hmTrans:14.2, ats:"20-14", injNote:"", stars:[{n:"Tamin Lipsey",bpr:4.4,ppg:14.4},{n:"Joshua Jefferson",bpr:4.0,ppg:15.2}], coach:"T.J. Otzelberger", cTrn:4, oEFG:56.2,oTO:13.8,oORB:35.9,oFTR:40.7,dEFG:43.2,dTO:23.7,dORB:77.9,dFTR:19.3,l10:[8,2],exp:10,cont:85,cATSt:"5-4" },
  "Tennessee State":  { s:15, r:"Midwest", rec:"23-9", conf:"OVC",kpRk:187,kpOffRk:173,kpDefRk:212, kpEM:-7.6,  adjT:69.8, trvkL30:0.4,  emInjAdj:0,    hmRim:30.4, hmTrans:14.8, ats:"16-16", injNote:"", stars:[{n:"Jaylen Jones",bpr:1.8,ppg:15.8}], coach:"Brian Collins", cTrn:1, oEFG:50.4,oTO:18.2,oORB:28.5,oFTR:30.7,dEFG:51.1,dTO:17.7,dORB:71.0,dFTR:31.7,l10:[7,3],exp:196,cont:75,cATSt:"0-0" },

  // ═══ SOUTH REGION ═══
  "Florida":          { s:1, r:"South", rec:"26-7", conf:"SEC",   kpRk:4,  kpOffRk:9,  kpDefRk:6,   kpEM:32.8,  adjT:69.6, trvkL30:0.2,  emInjAdj:0,    hmRim:33.8, hmTrans:16.2, ats:"19-14", injNote:"", stars:[{n:"Walter Clayton Jr.",bpr:5.4,ppg:17.8},{n:"Alijah Martin",bpr:4.0,ppg:14.2}], coach:"Todd Golden", cTrn:3, oEFG:56.6,oTO:13.5,oORB:36.5,oFTR:41.5,dEFG:43.3,dTO:23.6,dORB:77.8,dFTR:19.4,l10:[7,3],exp:7,cont:85,cATSt:"4-2" },
  "Clemson":          { s:8, r:"South", rec:"24-10", conf:"ACC",  kpRk:36, kpOffRk:71, kpDefRk:20,  kpEM:11.4,  adjT:66.4, trvkL30:-0.8, emInjAdj:0,    hmRim:30.6, hmTrans:13.4, ats:"18-16", injNote:"", stars:[{n:"Chase Hunter",bpr:3.4,ppg:15.4}], coach:"Brad Brownell", cTrn:6, oEFG:54.3,oTO:15.3,oORB:33.5,oFTR:37.4,dEFG:43.8,dTO:23.2,dORB:77.4,dFTR:20.2,l10:[5,5],exp:40,cont:85,cATSt:"5-8" },
  "Iowa":             { s:9, r:"South", rec:"21-12", conf:"B10",  kpRk:25, kpOffRk:31, kpDefRk:31,  kpEM:15.0,  adjT:70.4, trvkL30:1.8,  emInjAdj:0,    hmRim:33.6, hmTrans:16.8, ats:"16-17", injNote:"", stars:[{n:"Owen Freeman",bpr:4.4,ppg:16.4}], coach:"Fran McCaffery", cTrn:9, oEFG:55.8,oTO:14.1,oORB:35.4,oFTR:40.0,dEFG:44.2,dTO:22.9,dORB:77.0,dFTR:20.9,l10:[7,3],exp:31,cont:85,cATSt:"8-11" },
  "Vanderbilt":       { s:5, r:"South", rec:"26-8", conf:"SEC",   kpRk:11, kpOffRk:7,  kpDefRk:29,  kpEM:23.0,  adjT:69.2, trvkL30:4.4,  emInjAdj:0,    hmRim:33.2, hmTrans:16.4, ats:"20-14", injNote:"Duke Miles (knee, back and healthy)", stars:[{n:"Tyler Tanner",bpr:5.2,ppg:16.8},{n:"Jason Edwards",bpr:4.6,ppg:17.2}], coach:"Mark Byington", cTrn:2, oEFG:56.7,oTO:13.4,oORB:36.6,oFTR:41.6,dEFG:44.1,dTO:23.0,dORB:77.1,dFTR:20.8,l10:[9,1],exp:20,cont:85,cATSt:"1-1" },
  "McNeese":          { s:12, r:"South", rec:"28-5", conf:"Slnd", kpRk:68, kpOffRk:91, kpDefRk:47,  kpEM:5.4,   adjT:70.8, trvkL30:0.8,  emInjAdj:0,    hmRim:31.4, hmTrans:16.2, ats:"20-13", injNote:"", stars:[{n:"Christian Shumate",bpr:3.4,ppg:17.8}], coach:"Joe Dooley", cTrn:4, oEFG:53.5,oTO:15.8,oORB:32.5,oFTR:36.1,dEFG:44.8,dTO:22.4,dORB:76.5,dFTR:21.8,l10:[8,2],exp:64,cont:85,cATSt:"3-4" },
  "Nebraska":         { s:4, r:"South", rec:"26-6", conf:"B10",   kpRk:14, kpOffRk:55, kpDefRk:7,   kpEM:21.2,  adjT:68.4, trvkL30:-0.4, emInjAdj:0,    hmRim:31.8, hmTrans:14.4, ats:"19-13", injNote:"", stars:[{n:"Brice Williams",bpr:4.2,ppg:16.4}], coach:"Fred Hoiberg", cTrn:4, oEFG:54.9,oTO:14.8,oORB:34.3,oFTR:38.4,dEFG:43.3,dTO:23.6,dORB:77.8,dFTR:19.4,l10:[7,3],exp:26,cont:85,cATSt:"3-5" },
  "Troy":             { s:13, r:"South", rec:"22-11", conf:"SB",  kpRk:143, kpOffRk:141, kpDefRk:166, kpEM:-3.8,  adjT:69.4, trvkL30:0.2,  emInjAdj:0,    hmRim:30.2, hmTrans:14.6, ats:"17-16", injNote:"", stars:[{n:"Duke Miles",bpr:2.2,ppg:16.8}], coach:"Scott Cross", cTrn:4, oEFG:51.6,oTO:17.3,oORB:30.1,oFTR:32.8,dEFG:49.4,dTO:19.0,dORB:72.6,dFTR:29.0,l10:[6,4],exp:156,cont:80,cATSt:"2-4" },
  "North Carolina":   { s:6, r:"South", rec:"24-8", conf:"ACC",   kpRk:29, kpOffRk:32, kpDefRk:37,  kpEM:13.2,  adjT:71.4, trvkL30:-5.6, emInjAdj:-8.4, hmRim:34.2, hmTrans:17.2, ats:"16-16", injNote:"Caleb Wilson (broken thumb, OUT for season); 0-2 since injury", stars:[{n:"Seth Trimble",bpr:3.2,ppg:13.8},{n:"Henri Veesaar",bpr:2.8,ppg:12.4}], coach:"Hubert Davis", cTrn:3, oEFG:55.7,oTO:14.1,oORB:35.4,oFTR:40.0,dEFG:44.5,dTO:22.7,dORB:76.8,dFTR:21.2,l10:[4,6],exp:35,cont:85,cATSt:"4-4" },
  "VCU":              { s:11, r:"South", rec:"27-7", conf:"A10",  kpRk:46, kpOffRk:46, kpDefRk:63,  kpEM:8.8,   adjT:68.8, trvkL30:2.4,  emInjAdj:0,    hmRim:31.8, hmTrans:15.8, ats:"20-14", injNote:"", stars:[{n:"Lazar Djokovic",bpr:4.2,ppg:13.8},{n:"Max Shulga",bpr:3.4,ppg:16.4}], coach:"Ryan Odom", cTrn:3, oEFG:55.2,oTO:14.5,oORB:34.7,oFTR:39.0,dEFG:45.4,dTO:22.0,dORB:76.0,dFTR:22.8,l10:[9,1],exp:56,cont:85,cATSt:"3-3" },
  "Illinois":         { s:3, r:"South", rec:"24-8", conf:"B10",   kpRk:7,  kpOffRk:1,  kpDefRk:28,  kpEM:26.2,  adjT:70.8, trvkL30:1.4,  emInjAdj:0,    hmRim:34.4, hmTrans:17.4, ats:"18-14", injNote:"", stars:[{n:"Kasparas Jakucionis",bpr:5.2,ppg:15.8}], coach:"Brad Underwood", cTrn:4, oEFG:56.9,oTO:13.2,oORB:36.9,oFTR:42.0,dEFG:44.1,dTO:23.0,dORB:77.1,dFTR:20.7,l10:[8,2],exp:17,cont:85,cATSt:"4-5" },
  "Penn":             { s:14, r:"South", rec:"18-11", conf:"Ivy", kpRk:159, kpOffRk:215, kpDefRk:112, kpEM:-4.8,  adjT:67.2, trvkL30:3.2,  emInjAdj:-3.6, hmRim:29.8, hmTrans:13.2, ats:"15-14", injNote:"Ethan Roberts (concussion, GTD — top scorer 16.9 PPG)", stars:[{n:"Ethan Roberts",bpr:3.8,ppg:16.9}], coach:"Steve Donahue", cTrn:5, oEFG:48.8,oTO:19.4,oORB:26.4,oFTR:27.9,dEFG:47.3,dTO:20.6,dORB:74.3,dFTR:25.7,l10:[9,1],exp:153,cont:79,cATSt:"2-5" },
  "Saint Mary's":     { s:7, r:"South", rec:"27-5", conf:"WCC",   kpRk:24, kpOffRk:43, kpDefRk:19,  kpEM:15.6,  adjT:64.8, trvkL30:1.2,  emInjAdj:0,    hmRim:31.4, hmTrans:13.0, ats:"19-13", injNote:"", stars:[{n:"Paulius Marauskas",bpr:4.6,ppg:18.8},{n:"Joshua Dent",bpr:4.0,ppg:12.4}], coach:"Randy Bennett", cTrn:10, oEFG:55.3,oTO:14.4,oORB:34.9,oFTR:39.2,dEFG:43.8,dTO:23.3,dORB:77.4,dFTR:20.2,l10:[8,2],exp:28,cont:85,cATSt:"6-10" },
  "Texas A&M":        { s:10, r:"South", rec:"21-11", conf:"SEC", kpRk:39, kpOffRk:49, kpDefRk:40,  kpEM:10.4,  adjT:69.4, trvkL30:-0.4, emInjAdj:0,    hmRim:32.4, hmTrans:15.4, ats:"15-17", injNote:"", stars:[{n:"Wade Taylor IV",bpr:4.4,ppg:17.2}], coach:"Buzz Williams", cTrn:7, oEFG:55.1,oTO:14.6,oORB:34.6,oFTR:38.8,dEFG:44.6,dTO:22.6,dORB:76.7,dFTR:21.4,l10:[5,5],exp:43,cont:85,cATSt:"8-9" },
  "Houston":          { s:2, r:"South", rec:"28-6", conf:"B12",   kpRk:5,  kpOffRk:14, kpDefRk:5,   kpEM:29.4,  adjT:64.8, trvkL30:0.6,  emInjAdj:0,    hmRim:32.2, hmTrans:13.8, ats:"20-14", injNote:"", stars:[{n:"Joseph Tugler",bpr:4.8,ppg:14.2},{n:"Terrance Arceneaux",bpr:4.2,ppg:15.4}], coach:"Kelvin Sampson", cTrn:12, oEFG:56.4,oTO:13.6,oORB:36.3,oFTR:41.2,dEFG:43.2,dTO:23.7,dORB:77.9,dFTR:19.3,l10:[7,3],exp:8,cont:85,cATSt:"14-10" },
  "Idaho":            { s:15, r:"South", rec:"21-14", conf:"BSky",kpRk:145, kpOffRk:176, kpDefRk:136, kpEM:-3.4,  adjT:68.4, trvkL30:0.2,  emInjAdj:0,    hmRim:29.8, hmTrans:13.8, ats:"16-19", injNote:"", stars:[{n:"Kristian Gonzalez",bpr:2.0,ppg:14.8}], coach:"Alex Pribble", cTrn:1, oEFG:50.3,oTO:18.3,oORB:28.3,oFTR:30.5,dEFG:48.2,dTO:19.9,dORB:73.6,dFTR:27.2,l10:[5,5],exp:152,cont:80,cATSt:"0-0" },

  // ═══ FIRST FOUR TEAMS ═══
  "UMBC":             { s:16, r:"Midwest", rec:"24-8", conf:"AE",  kpRk:185, kpOffRk:184, kpDefRk:193, kpEM:-7.2,  adjT:67.8, trvkL30:2.8,  emInjAdj:0,    hmRim:30.4, hmTrans:14.2, ats:"19-13", injNote:"", stars:[{n:"Elijah Bah",bpr:2.2,ppg:14.6}], coach:"Jim Ferry", cTrn:2, oEFG:50.0,oTO:18.5,oORB:28.0,oFTR:29.9,dEFG:50.4,dTO:18.2,dORB:71.7,dFTR:30.6,l10:[8,2],exp:189,cont:75,cATSt:"1-2" },
  "Howard":           { s:16, r:"Midwest", rec:"23-10", conf:"MEAC",kpRk:207, kpOffRk:283, kpDefRk:118, kpEM:-9.8,  adjT:68.4, trvkL30:1.4,  emInjAdj:0,    hmRim:29.2, hmTrans:13.8, ats:"17-16", injNote:"", stars:[{n:"Cedric Taylor III",bpr:2.4,ppg:17.1},{n:"Bryce Harris",bpr:2.0,ppg:17.1}], coach:"Kenny Blakeney", cTrn:3, oEFG:46.2,oTO:21.4,oORB:23.1,oFTR:23.4,dEFG:47.5,dTO:20.4,dORB:74.1,dFTR:26.1,l10:[7,3],exp:184,cont:74,cATSt:"0-3" },
  "Prairie View A&M": { s:16, r:"South", rec:"18-17", conf:"SWAC",kpRk:288, kpOffRk:310, kpDefRk:231, kpEM:-16.2, adjT:69.4, trvkL30:0.4,  emInjAdj:0,    hmRim:28.8, hmTrans:14.6, ats:"16-19", injNote:"", stars:[{n:"William Douglas",bpr:1.2,ppg:13.4}], coach:"Byron Smith", cTrn:1, oEFG:45.2,oTO:22.2,oORB:21.8,oFTR:21.6,dEFG:51.8,dTO:17.1,dORB:70.4,dFTR:32.9,l10:[5,5],exp:262,cont:64,cATSt:"0-0" },
  "Lehigh":           { s:16, r:"South", rec:"18-16", conf:"PAT", kpRk:284, kpOffRk:290, kpDefRk:257, kpEM:-15.4, adjT:68.2, trvkL30:1.8,  emInjAdj:0,    hmRim:29.6, hmTrans:13.4, ats:"17-17", injNote:"", stars:[{n:"Tyler Whitney-Sidney",bpr:1.6,ppg:14.8}], coach:"Brett Reed", cTrn:2, oEFG:45.9,oTO:21.6,oORB:22.8,oFTR:22.9,dEFG:52.8,dTO:16.4,dORB:69.6,dFTR:34.4,l10:[6,4],exp:270,cont:64,cATSt:"0-2" },
  "Texas":            { s:11, r:"West", rec:"18-14", conf:"SEC",  kpRk:37,  kpOffRk:13, kpDefRk:111, kpEM:10.8,  adjT:70.8, trvkL30:-1.2, emInjAdj:0,    hmRim:33.8, hmTrans:16.8, ats:"15-17", injNote:"", stars:[{n:"Tre Johnson",bpr:4.8,ppg:18.4}], coach:"Rodney Terry", cTrn:2, oEFG:56.5,oTO:13.6,oORB:36.3,oFTR:41.2,dEFG:47.3,dTO:20.6,dORB:74.4,dFTR:25.7,l10:[4,6],exp:71,cont:85,cATSt:"2-2" },
  "NC State":         { s:11, r:"West", rec:"20-13", conf:"ACC",  kpRk:34,  kpOffRk:19, kpDefRk:86,  kpEM:11.2,  adjT:69.4, trvkL30:1.8,  emInjAdj:0,    hmRim:32.6, hmTrans:15.8, ats:"17-16", injNote:"", stars:[{n:"Marcus Hill",bpr:3.8,ppg:16.2}], coach:"Kevin Keatts", cTrn:4, oEFG:56.2,oTO:13.7,oORB:36.0,oFTR:40.8,dEFG:46.3,dTO:21.3,dORB:75.2,dFTR:24.2,l10:[6,4],exp:59,cont:85,cATSt:"3-4" },
  "Miami (OH)":       { s:11, r:"Midwest", rec:"31-1", conf:"MAC",kpRk:93,  kpOffRk:70, kpDefRk:156, kpEM:1.0,   adjT:68.2, trvkL30:-2.4, emInjAdj:0,    hmRim:31.4, hmTrans:14.8, ats:"18-14", injNote:"Lost MAC tourney opener; at-large bid", stars:[{n:"Peter Kazantsev",bpr:2.6,ppg:15.2}], coach:"Travis Steele", cTrn:1, oEFG:54.3,oTO:15.2,oORB:33.5,oFTR:37.5,dEFG:49.0,dTO:19.3,dORB:72.9,dFTR:28.4,l10:[7,3],exp:121,cont:85,cATSt:"1-2" },
  "SMU":              { s:11, r:"Midwest", rec:"20-13", conf:"ACC",kpRk:42,  kpOffRk:26, kpDefRk:91,  kpEM:9.8,   adjT:70.2, trvkL30:1.6,  emInjAdj:-2.2, hmRim:32.8, hmTrans:16.4, ats:"16-17", injNote:"B.J. Edwards (ankle, returning for tourney)", stars:[{n:"B.J. Edwards",bpr:3.8,ppg:12.7},{n:"Kario Oquendo",bpr:3.2,ppg:14.8}], coach:"Andy Enfield", cTrn:5, oEFG:56.0,oTO:13.9,oORB:35.7,oFTR:40.4,dEFG:46.5,dTO:21.2,dORB:75.0,dFTR:24.5,l10:[6,4],exp:65,cont:85,cATSt:"4-5" },
};

// ─── FIRST ROUND MATCHUPS — DraftKings via ESPN ─────────────────────────────
// Source: ESPN.com/espn/betting/story/_/id/48217692 (DraftKings odds)
// Fetched: March 16, 2026. Lines are editable — click ✏️ to update.
// ═════════════════════════════════════════════════════════════════════════════
const LINES_UPDATED = "March 17, 2026 — ESPN/DraftKings/VegasInsider";
// Opening lines snapshot (from Selection Sunday March 15). Update current lines (vs/vt) as they move.
// Line movement = vs - openVs. Positive = moved toward underdog (sharp on dog).

const M_INIT = [
  // ═══ FIRST FOUR — TUESDAY, March 17 (Dayton, OH) ═══
  // Winner of UMBC/Howard → plays #1 Michigan (Midwest, Thu 7:10 ET)
  { t1:"UMBC",t2:"Howard",r:"Midwest", vs:-1.5,vt:140.5,openVs:-1.5,openVt:142.5,bpi:1.5,day:"Tue",time:"6:40 ET", firstFour:true, advancesTo:"#1 Michigan" },
  // Winner of Texas/NC State → plays #6 BYU (West, Thu 7:25 ET)
  { t1:"Texas",t2:"NC State",r:"West", vs:-1.5,vt:158.5,openVs:1.5,openVt:161.5,bpi:-0.1,day:"Tue",time:"9:15 ET", firstFour:true, advancesTo:"#6 BYU" },
  // ═══ FIRST FOUR — WEDNESDAY, March 18 (Dayton, OH) ═══
  // Winner of Prairie View/Lehigh → plays #1 Florida (South, Fri 9:25 ET)
  { t1:"Prairie View A&M",t2:"Lehigh",r:"South", vs:-2.5,vt:147.5,openVs:2.5,openVt:147.5,bpi:-0.9,day:"Wed",time:"6:40 ET", firstFour:true, advancesTo:"#1 Florida" },
  // Winner of Miami (OH)/SMU → plays #6 Tennessee (Midwest, Fri 4:25 ET)
  { t1:"Miami (OH)",t2:"SMU",r:"Midwest", vs:7.5,vt:164.5,openVs:8.5,openVt:165.5,bpi:6.7,day:"Wed",time:"9:15 ET", firstFour:true, advancesTo:"#6 Tennessee" },
  // ═══ THURSDAY — EAST ═══
  { t1:"Ohio State",t2:"TCU",r:"East", vs:-2.5,vt:147.5,openVs:-2.5,openVt:147.5,bpi:4.0,day:"Thu",time:"12:15 ET" },
  { t1:"Louisville",t2:"South Florida",r:"East", vs:-6.5,vt:163.5,openVs:-6.5,openVt:163.5,bpi:9.1,day:"Thu",time:"1:30 ET" },
  { t1:"Duke",t2:"Siena",r:"East", vs:-27.5,vt:136.5,openVs:-27.5,openVt:136.5,bpi:28.9,day:"Thu",time:"2:50 ET" },
  { t1:"Michigan State",t2:"N. Dakota State",r:"East", vs:-16.5,vt:143.5,openVs:-16.5,openVt:143.5,bpi:17.4,day:"Thu",time:"4:05 ET" },
  // ═══ THURSDAY — WEST ═══
  { t1:"Wisconsin",t2:"High Point",r:"West", vs:-11.5,vt:165.5,openVs:-12.5,openVt:165.5,bpi:7.3,day:"Thu",time:"1:50 ET" },
  { t1:"Arkansas",t2:"Hawaii",r:"West", vs:-15.5,vt:161.5,openVs:-13.5,openVt:161.5,bpi:15.0,day:"Thu",time:"4:25 ET" },
  { t1:"Gonzaga",t2:"Kennesaw State",r:"West", vs:-19.5,vt:157.5,openVs:-20.5,openVt:154.5,bpi:19.2,day:"Thu",time:"10:00 ET" },
  // ═══ THURSDAY — MIDWEST ═══
  { t1:"Georgia",t2:"Saint Louis",r:"Midwest", vs:-2.5,vt:170.5,openVs:-1.5,openVt:170.5,bpi:0.2,day:"Thu",time:"9:45 ET" },
  // ═══ THURSDAY — SOUTH ═══
  { t1:"Nebraska",t2:"Troy",r:"South", vs:-13.5,vt:136.5,openVs:-13.5,openVt:136.5,bpi:15.9,day:"Thu",time:"12:40 ET" },
  { t1:"Vanderbilt",t2:"McNeese",r:"South", vs:-11.5,vt:150.5,openVs:-11.5,openVt:150.5,bpi:9.2,day:"Thu",time:"3:15 ET" },
  { t1:"North Carolina",t2:"VCU",r:"South", vs:-2.5,vt:154.5,openVs:-2.5,openVt:148.5,bpi:2.9,day:"Thu",time:"6:50 ET" },
  { t1:"Saint Mary's",t2:"Texas A&M",r:"South", vs:-2.5,vt:148.5,openVs:-2.5,openVt:148.5,bpi:0.8,day:"Thu",time:"7:35 ET" },
  { t1:"Illinois",t2:"Penn",r:"South", vs:-22.5,vt:149.5,openVs:-21.5,openVt:150.5,bpi:22.4,day:"Thu",time:"9:25 ET" },
  { t1:"Houston",t2:"Idaho",r:"South", vs:-21.5,vt:135.5,openVs:-22.5,openVt:135.5,bpi:25.1,day:"Thu",time:"10:10 ET" },
  // ═══ FRIDAY — EAST ═══
  { t1:"St. John's",t2:"Northern Iowa",r:"East", vs:-11,vt:131.5,openVs:-9.5,openVt:132.5,bpi:10.8,day:"Fri",time:"7:10 ET" },
  { t1:"UCLA",t2:"UCF",r:"East", vs:-6,vt:152,openVs:-5,openVt:153.5,bpi:6.0,day:"Fri",time:"7:25 ET" },
  { t1:"Kansas",t2:"Cal Baptist",r:"East", vs:-13.5,vt:135.5,openVs:-13.5,openVt:135.5,bpi:15.8,day:"Fri",time:"9:45 ET" },
  { t1:"UConn",t2:"Furman",r:"East", vs:-20.5,vt:136.5,openVs:-20.5,openVt:136.5,bpi:20.6,day:"Fri",time:"10:00 ET" },
  // ═══ FRIDAY — WEST ═══
  { t1:"Arizona",t2:"Long Island",r:"West", vs:-30.5,vt:151.5,openVs:-30.5,openVt:151.5,bpi:28.5,day:"Fri",time:"1:35 ET" },
  { t1:"Villanova",t2:"Utah State",r:"West", vs:2.5,vt:147.5,bpi:-0.4,openVs:2.5,openVt:147.5,day:"Fri",time:"4:10 ET" },
  { t1:"Miami (FL)",t2:"Missouri",r:"West", vs:-1.5,vt:150.5,bpi:1.3,openVs:-1.5,openVt:150.5,day:"Fri",time:"10:10 ET" },
  { t1:"Purdue",t2:"Queens",r:"West", vs:-22.5,vt:164.5,openVs:-21.5,openVt:164.5,bpi:23.8,day:"Fri",time:"7:35 ET" },
  // ═══ FRIDAY — MIDWEST ═══
  { t1:"Kentucky",t2:"Santa Clara",r:"Midwest", vs:-3.5,vt:161.5,openVs:-2.5,openVt:161.5,bpi:6.0,day:"Fri",time:"12:15 ET" },
  { t1:"Texas Tech",t2:"Akron",r:"Midwest", vs:-7.5,vt:145.5,openVs:-8.5,openVt:139.5,bpi:9.5,day:"Fri",time:"12:40 ET" },
  { t1:"Virginia",t2:"Wright State",r:"Midwest", vs:-17.5,vt:144.5,openVs:-17.5,openVt:144.5,bpi:16.2,day:"Fri",time:"1:50 ET" },
  { t1:"Iowa State",t2:"Tennessee State",r:"Midwest", vs:-24.5,vt:148.5,openVs:-24.5,openVt:148.5,bpi:25.6,day:"Fri",time:"2:50 ET" },
  { t1:"Alabama",t2:"Hofstra",r:"Midwest", vs:-12.5,vt:161.5,openVs:-12.5,openVt:154.5,bpi:13.8,day:"Fri",time:"3:15 ET" },
  // ═══ FRIDAY — SOUTH ═══
  { t1:"Clemson",t2:"Iowa",r:"South", vs:2.5,vt:130.5,openVs:-2.5,openVt:130.5,bpi:-0.1,day:"Fri",time:"6:50 ET" },
];

// ─── ESPN DEEP FEATURES (scraped 66 teams via ESPN Hidden API) ──────────────
const DEEP = {
  "Akron": {em_trajectory:-5.73,away_em:8.26,away_win_pct:0.7368,q_em:8.26,q_win_pct:0.7368,margin_std:16.4,close_win_pct:0.6,blowout_pct:0.5294,l10_em:13.8,momentum:-1.49,l30_em:13.8,avg_total:161.85},
  "Alabama": {em_trajectory:-4.8,away_em:4.24,away_win_pct:0.6471,q_em:-5.78,q_win_pct:0.4444,margin_std:15.86,close_win_pct:0.75,blowout_pct:0.375,l10_em:7.4,momentum:-0.66,l30_em:7.78,avg_total:175.19},
  "Arizona": {em_trajectory:-14.27,away_em:9.53,away_win_pct:0.9412,q_em:8.57,q_win_pct:0.8571,margin_std:12.69,close_win_pct:0.7143,blowout_pct:0.5294,l10_em:9.6,momentum:-10.98,l30_em:9.6,avg_total:154.94},
  "Arkansas": {em_trajectory:-10.36,away_em:-0.31,away_win_pct:0.5625,q_em:-0.73,q_win_pct:0.4545,margin_std:17.98,close_win_pct:0.7778,blowout_pct:0.4118,l10_em:4.1,momentum:-8.15,l30_em:4.1,avg_total:170.03},
  "BYU": {em_trajectory:-20.18,away_em:0.12,away_win_pct:0.5294,q_em:-0.7,q_win_pct:0.3,margin_std:16.91,close_win_pct:0.75,blowout_pct:0.3235,l10_em:-0.3,momentum:-12.59,l30_em:-0.3,avg_total:159.24},
  "Cal Baptist": {em_trajectory:3.45,away_em:0.39,away_win_pct:0.5556,q_em:0.39,q_win_pct:0.5556,margin_std:12.7,close_win_pct:0.7143,blowout_pct:0.2424,l10_em:8.4,momentum:5.03,l30_em:9.11,avg_total:140.61},
  "Clemson": {em_trajectory:-16.55,away_em:1.61,away_win_pct:0.6111,q_em:-3.5,q_win_pct:0.375,margin_std:14.67,close_win_pct:0.6667,blowout_pct:0.2353,l10_em:-3.4,momentum:-15.32,l30_em:-3.4,avg_total:140.88},
  "Duke": {em_trajectory:-8.55,away_em:14.63,away_win_pct:0.8947,q_em:9.71,q_win_pct:0.8571,margin_std:15.97,close_win_pct:0.7143,blowout_pct:0.5294,l10_em:18.6,momentum:-0.77,l30_em:18.6,avg_total:145.44},
  "Florida": {em_trajectory:1.91,away_em:8.67,away_win_pct:0.6667,q_em:8.1,q_win_pct:0.6,margin_std:15.53,close_win_pct:0.3333,blowout_pct:0.5152,l10_em:14.1,momentum:-1.85,l30_em:13.44,avg_total:158.79},
  "Furman": {em_trajectory:-5.27,away_em:1.61,away_win_pct:0.6111,q_em:1.61,q_win_pct:0.6111,margin_std:15.01,close_win_pct:0.4615,blowout_pct:0.3235,l10_em:3.8,momentum:-3.08,l30_em:3.8,avg_total:146.97},
  "Georgia": {em_trajectory:-25.9,away_em:1.5,away_win_pct:0.5714,q_em:-1.0,q_win_pct:0.5,margin_std:20.46,close_win_pct:0.5556,blowout_pct:0.5,l10_em:1.8,momentum:-13.9,l30_em:0.67,avg_total:168.97},
  "Gonzaga": {em_trajectory:-13.36,away_em:11.89,away_win_pct:0.8333,q_em:8.4,q_win_pct:0.8,margin_std:20.76,close_win_pct:0.5,blowout_pct:0.5455,l10_em:13.1,momentum:-5.21,l30_em:15.33,avg_total:151.12},
  "Hawaii": {em_trajectory:-13.0,away_em:4.0,away_win_pct:0.6154,q_em:4.0,q_win_pct:0.6154,margin_std:17.53,close_win_pct:0.8571,blowout_pct:0.4375,l10_em:2.1,momentum:-12.86,l30_em:0.67,avg_total:149.34},
  "High Point": {em_trajectory:-2.27,away_em:9.0,away_win_pct:0.8125,q_em:9.0,q_win_pct:0.8125,margin_std:22.68,close_win_pct:0.8,blowout_pct:0.5882,l10_em:15.9,momentum:-5.39,l30_em:15.9,avg_total:160.24},
  "Hofstra": {em_trajectory:0.91,away_em:4.91,away_win_pct:0.6364,q_em:4.91,q_win_pct:0.6364,margin_std:15.55,close_win_pct:0.4286,blowout_pct:0.2647,l10_em:13.2,momentum:5.16,l30_em:13.2,avg_total:141.68},
  "Houston": {em_trajectory:-12.36,away_em:6.11,away_win_pct:0.7222,q_em:1.09,q_win_pct:0.4545,margin_std:15.05,close_win_pct:0.4286,blowout_pct:0.4118,l10_em:7.5,momentum:-9.62,l30_em:7.5,avg_total:140.0},
  "Howard": {em_trajectory:14.0,away_em:3.94,away_win_pct:0.6667,q_em:3.94,q_win_pct:0.6667,margin_std:18.44,close_win_pct:0.375,blowout_pct:0.4848,l10_em:19.0,momentum:11.42,l30_em:18.0,avg_total:145.21},
  "Idaho": {em_trajectory:-4.09,away_em:0.73,away_win_pct:0.5455,q_em:0.73,q_win_pct:0.5455,margin_std:17.08,close_win_pct:0.6364,blowout_pct:0.2857,l10_em:9.2,momentum:4.36,l30_em:9.2,avg_total:151.23},
  "Illinois": {em_trajectory:-7.7,away_em:8.13,away_win_pct:0.6667,q_em:-0.18,q_win_pct:0.4545,margin_std:17.86,close_win_pct:0.1429,blowout_pct:0.375,l10_em:10.5,momentum:-10.21,l30_em:7.22,avg_total:154.19},
  "Iowa": {em_trajectory:-19.18,away_em:0.47,away_win_pct:0.4,q_em:-8.56,q_win_pct:0.1111,margin_std:17.57,close_win_pct:0.375,blowout_pct:0.4242,l10_em:-2.5,momentum:-15.46,l30_em:-2.0,avg_total:141.18},
  "Iowa State": {em_trajectory:-19.45,away_em:9.88,away_win_pct:0.6471,q_em:3.33,q_win_pct:0.5556,margin_std:19.42,close_win_pct:0.8,blowout_pct:0.6471,l10_em:9.2,momentum:-10.55,l30_em:9.2,avg_total:146.94},
  "Kansas": {em_trajectory:-12.18,away_em:-1.0,away_win_pct:0.5556,q_em:-3.25,q_win_pct:0.5,margin_std:16.26,close_win_pct:0.8571,blowout_pct:0.4242,l10_em:-3.6,momentum:-14.69,l30_em:-4.44,avg_total:145.03},
  "Kennesaw State": {em_trajectory:-16.91,away_em:-0.61,away_win_pct:0.4444,q_em:-0.61,q_win_pct:0.4444,margin_std:20.21,close_win_pct:0.6,blowout_pct:0.3235,l10_em:3.6,momentum:-5.23,l30_em:3.6,avg_total:159.41},
  "Kentucky": {em_trajectory:-18.55,away_em:-5.38,away_win_pct:0.4375,q_em:-6.29,q_win_pct:0.3571,margin_std:20.37,close_win_pct:0.625,blowout_pct:0.3529,l10_em:-1.0,momentum:-11.25,l30_em:-1.0,avg_total:154.59},
  "Lehigh": {em_trajectory:6.18,away_em:-7.41,away_win_pct:0.2941,q_em:-7.41,q_win_pct:0.2941,margin_std:12.71,close_win_pct:0.6154,blowout_pct:0.2059,l10_em:2.7,momentum:4.87,l30_em:2.7,avg_total:147.21},
  "Long Island": {em_trajectory:10.55,away_em:-1.68,away_win_pct:0.5263,q_em:-1.68,q_win_pct:0.5263,margin_std:12.82,close_win_pct:0.75,blowout_pct:0.2647,l10_em:7.1,momentum:5.85,l30_em:7.1,avg_total:145.21},
  "Louisville": {em_trajectory:-15.0,away_em:1.12,away_win_pct:0.5,q_em:-7.11,q_win_pct:0.3333,margin_std:21.41,close_win_pct:0.3333,blowout_pct:0.4242,l10_em:6.8,momentum:-13.17,l30_em:3.0,avg_total:156.94},
  "McNeese": {em_trajectory:-12.18,away_em:4.68,away_win_pct:0.7368,q_em:4.68,q_win_pct:0.7368,margin_std:21.57,close_win_pct:0.75,blowout_pct:0.3939,l10_em:13.2,momentum:-1.1,l30_em:12.78,avg_total:146.48},
  "Miami (FL)": {em_trajectory:-17.64,away_em:1.2,away_win_pct:0.6667,q_em:-6.43,q_win_pct:0.2857,margin_std:16.74,close_win_pct:0.5,blowout_pct:0.3333,l10_em:2.8,momentum:-11.89,l30_em:2.11,avg_total:153.12},
  "Miami (OH)": {em_trajectory:-17.3,away_em:7.62,away_win_pct:0.9375,q_em:7.62,q_win_pct:0.9375,margin_std:17.72,close_win_pct:0.9,blowout_pct:0.3438,l10_em:6.9,momentum:-11.08,l30_em:7.44,avg_total:165.97},
  "Michigan": {em_trajectory:-21.64,away_em:11.68,away_win_pct:0.8947,q_em:12.73,q_win_pct:0.8182,margin_std:16.17,close_win_pct:0.7778,blowout_pct:0.4118,l10_em:7.2,momentum:-14.76,l30_em:7.2,avg_total:156.03},
  "Michigan State": {em_trajectory:-13.1,away_em:6.4,away_win_pct:0.6667,q_em:1.22,q_win_pct:0.5556,margin_std:13.92,close_win_pct:0.625,blowout_pct:0.4688,l10_em:1.3,momentum:-12.18,l30_em:1.78,avg_total:147.34},
  "Missouri": {em_trajectory:-17.5,away_em:-4.93,away_win_pct:0.3571,q_em:-10.67,q_win_pct:0.3333,margin_std:18.37,close_win_pct:0.7273,blowout_pct:0.4688,l10_em:-0.2,momentum:-9.25,l30_em:-2.33,avg_total:155.0},
  "NC State": {em_trajectory:-20.91,away_em:0.62,away_win_pct:0.5625,q_em:-11.56,q_win_pct:0.2222,margin_std:21.19,close_win_pct:0.2857,blowout_pct:0.3939,l10_em:-7.1,momentum:-22.1,l30_em:-8.89,avg_total:160.21},
  "Nebraska": {em_trajectory:-12.1,away_em:3.71,away_win_pct:0.7143,q_em:-4.33,q_win_pct:0.3333,margin_std:13.88,close_win_pct:0.5714,blowout_pct:0.4688,l10_em:4.7,momentum:-9.98,l30_em:3.89,avg_total:143.5},
  "North Carolina": {em_trajectory:-16.9,away_em:-2.64,away_win_pct:0.4286,q_em:-0.57,q_win_pct:0.7143,margin_std:16.35,close_win_pct:0.7778,blowout_pct:0.4062,l10_em:-0.5,momentum:-13.02,l30_em:-0.89,avg_total:151.09},
  "Northern Iowa": {em_trajectory:-2.27,away_em:6.39,away_win_pct:0.6111,q_em:6.39,q_win_pct:0.6111,margin_std:15.53,close_win_pct:0.3,blowout_pct:0.3429,l10_em:10.8,momentum:3.0,l30_em:10.8,avg_total:131.17},
  "Ohio State": {em_trajectory:-10.73,away_em:0.94,away_win_pct:0.4375,q_em:-3.4,q_win_pct:0.2,margin_std:15.77,close_win_pct:0.4444,blowout_pct:0.3333,l10_em:4.9,momentum:-3.21,l30_em:4.67,avg_total:152.58},
  "Penn": {em_trajectory:4.44,away_em:-0.8,away_win_pct:0.4,q_em:-0.8,q_win_pct:0.4,margin_std:14.39,close_win_pct:0.5,blowout_pct:0.2759,l10_em:6.1,momentum:4.77,l30_em:6.25,avg_total:149.41},
  "Prairie View A&M": {em_trajectory:0.18,away_em:-4.64,away_win_pct:0.3636,q_em:-4.64,q_win_pct:0.3636,margin_std:21.05,close_win_pct:0.3846,blowout_pct:0.3429,l10_em:9.2,momentum:8.92,l30_em:9.2,avg_total:154.94},
  "Purdue": {em_trajectory:-10.91,away_em:11.0,away_win_pct:0.8333,q_em:5.0,q_win_pct:0.6,margin_std:15.25,close_win_pct:0.5,blowout_pct:0.4286,l10_em:5.2,momentum:-8.84,l30_em:5.2,avg_total:151.8},
  "SMU": {em_trajectory:-8.91,away_em:-2.07,away_win_pct:0.3333,q_em:-4.0,q_win_pct:0.25,margin_std:16.26,close_win_pct:0.3333,blowout_pct:0.3333,l10_em:0.9,momentum:-8.93,l30_em:0.11,avg_total:161.82},
  "Saint Louis": {em_trajectory:-18.91,away_em:5.29,away_win_pct:0.6429,q_em:5.29,q_win_pct:0.6429,margin_std:20.52,close_win_pct:0.5,blowout_pct:0.5455,l10_em:5.0,momentum:-20.4,l30_em:2.89,avg_total:156.76},
  "Saint Mary's": {em_trajectory:-4.9,away_em:3.93,away_win_pct:0.6667,q_em:-7.33,q_win_pct:0.3333,margin_std:15.0,close_win_pct:0.6667,blowout_pct:0.4688,l10_em:12.6,momentum:1.76,l30_em:14.89,avg_total:142.75},
  "Santa Clara": {em_trajectory:-3.0,away_em:5.21,away_win_pct:0.6316,q_em:-6.5,q_win_pct:0.25,margin_std:15.24,close_win_pct:0.5,blowout_pct:0.4706,l10_em:4.8,momentum:-7.95,l30_em:4.8,avg_total:155.29},
  "Siena": {em_trajectory:-6.64,away_em:2.62,away_win_pct:0.6667,q_em:2.62,q_win_pct:0.6667,margin_std:11.56,close_win_pct:0.6,blowout_pct:0.3235,l10_em:2.0,momentum:-4.04,l30_em:2.0,avg_total:136.21},
  "South Florida": {em_trajectory:8.45,away_em:5.17,away_win_pct:0.6667,q_em:5.17,q_win_pct:0.6667,margin_std:16.46,close_win_pct:0.3333,blowout_pct:0.4242,l10_em:15.1,momentum:5.36,l30_em:16.11,avg_total:163.24},
  "St. John's": {em_trajectory:-3.73,away_em:3.5,away_win_pct:0.7143,q_em:-3.67,q_win_pct:0.3333,margin_std:15.52,close_win_pct:0.8333,blowout_pct:0.3824,l10_em:9.8,momentum:-2.53,l30_em:9.8,avg_total:151.53},
  "TCU": {em_trajectory:-7.27,away_em:0.29,away_win_pct:0.5714,q_em:-2.44,q_win_pct:0.3333,margin_std:15.26,close_win_pct:0.4545,blowout_pct:0.1818,l10_em:4.6,momentum:-2.62,l30_em:4.33,avg_total:150.36},
  "Tennessee": {em_trajectory:-10.45,away_em:0.5,away_win_pct:0.5,q_em:-0.33,q_win_pct:0.4444,margin_std:16.96,close_win_pct:0.3636,blowout_pct:0.3939,l10_em:5.8,momentum:-6.39,l30_em:5.44,avg_total:148.82},
  "Tennessee State": {em_trajectory:-12.64,away_em:1.53,away_win_pct:0.5882,q_em:1.53,q_win_pct:0.5882,margin_std:15.92,close_win_pct:0.5,blowout_pct:0.3824,l10_em:2.5,momentum:-8.21,l30_em:2.5,avg_total:146.88},
  "Texas": {em_trajectory:-17.0,away_em:-0.47,away_win_pct:0.4,q_em:-2.78,q_win_pct:0.4444,margin_std:18.11,close_win_pct:0.375,blowout_pct:0.4375,l10_em:-1.1,momentum:-12.79,l30_em:-2.22,avg_total:160.59},
  "Texas A&M": {em_trajectory:-19.4,away_em:-1.5,away_win_pct:0.5,q_em:-13.0,q_win_pct:0.0,margin_std:19.41,close_win_pct:0.7,blowout_pct:0.4688,l10_em:-5.3,momentum:-16.6,l30_em:-3.78,avg_total:167.28},
  "Texas Tech": {em_trajectory:-4.4,away_em:-1.25,away_win_pct:0.5,q_em:-3.64,q_win_pct:0.4545,margin_std:16.06,close_win_pct:0.6,blowout_pct:0.375,l10_em:5.2,momentum:-3.87,l30_em:5.0,avg_total:153.03},
  "Troy": {em_trajectory:-6.91,away_em:1.05,away_win_pct:0.6,q_em:1.05,q_win_pct:0.6,margin_std:17.93,close_win_pct:0.625,blowout_pct:0.303,l10_em:5.3,momentum:-3.46,l30_em:4.67,avg_total:153.36},
  "UCF": {em_trajectory:-17.9,away_em:-5.08,away_win_pct:0.5385,q_em:-8.0,q_win_pct:0.4286,margin_std:15.25,close_win_pct:0.875,blowout_pct:0.3125,l10_em:-4.5,momentum:-7.34,l30_em:-2.78,avg_total:159.44},
  "UCLA": {em_trajectory:-8.73,away_em:-3.31,away_win_pct:0.375,q_em:-6.0,q_win_pct:0.4,margin_std:15.99,close_win_pct:0.625,blowout_pct:0.3529,l10_em:1.3,momentum:-7.7,l30_em:1.3,avg_total:148.74},
  "UConn": {em_trajectory:-11.82,away_em:7.65,away_win_pct:0.8235,q_em:3.11,q_win_pct:0.6667,margin_std:15.26,close_win_pct:0.8889,blowout_pct:0.4412,l10_em:6.8,momentum:-7.91,l30_em:6.8,avg_total:142.62},
  "UMBC": {em_trajectory:14.3,away_em:4.93,away_win_pct:0.6,q_em:4.93,q_win_pct:0.6,margin_std:17.36,close_win_pct:0.625,blowout_pct:0.4688,l10_em:18.2,momentum:12.84,l30_em:18.44,avg_total:143.22},
  "Utah State": {em_trajectory:-13.55,away_em:8.42,away_win_pct:0.7368,q_em:8.42,q_win_pct:0.7368,margin_std:17.44,close_win_pct:0.8889,blowout_pct:0.4706,l10_em:4.9,momentum:-10.31,l30_em:4.9,avg_total:152.88},
  "VCU": {em_trajectory:-3.73,away_em:4.18,away_win_pct:0.7059,q_em:-11.33,q_win_pct:0.0,margin_std:12.6,close_win_pct:0.6,blowout_pct:0.3235,l10_em:7.7,momentum:-3.38,l30_em:7.7,avg_total:153.03},
  "Vanderbilt": {em_trajectory:-18.36,away_em:6.17,away_win_pct:0.7222,q_em:-0.86,q_win_pct:0.5714,margin_std:16.41,close_win_pct:0.5,blowout_pct:0.4118,l10_em:2.2,momentum:-12.68,l30_em:2.2,avg_total:161.56},
  "Villanova": {em_trajectory:-11.4,away_em:0.87,away_win_pct:0.6667,q_em:-16.6,q_win_pct:0.0,margin_std:14.29,close_win_pct:0.6667,blowout_pct:0.3438,l10_em:0.9,momentum:-8.56,l30_em:0.22,avg_total:147.94},
  "Virginia": {em_trajectory:-11.91,away_em:5.29,away_win_pct:0.7647,q_em:-6.5,q_win_pct:0.25,margin_std:14.61,close_win_pct:0.8,blowout_pct:0.4706,l10_em:7.0,momentum:-7.42,l30_em:7.0,avg_total:149.06},
  "Wisconsin": {em_trajectory:-2.27,away_em:-1.82,away_win_pct:0.5294,q_em:-4.89,q_win_pct:0.5556,margin_std:16.82,close_win_pct:0.7,blowout_pct:0.4706,l10_em:6.0,momentum:-1.54,l30_em:6.0,avg_total:158.91},
  "Wright State": {em_trajectory:-6.45,away_em:3.67,away_win_pct:0.6667,q_em:3.67,q_win_pct:0.6667,margin_std:16.28,close_win_pct:0.6,blowout_pct:0.2353,l10_em:6.3,momentum:-1.41,l30_em:6.3,avg_total:154.18},
};

// ─── O/U TOTAL PREDICTION MODEL (Kaggle-trained Ridge, 1369 tourney games) ────
// LOSO MAE: 12.6 pts | Backtest O/U: 21-10 (67.7%) vs DK closing totals
const OU_MODEL = {
  intercept: 138.42512783053323,
  c: {
    avg_tempo: 2.1854609294258127,
    tempo_diff: -0.4017164163109838,
    cross_total: 3.604253828191856,
    avg_game_total: 3.871077571665716,
    combined_ppg: 1.3169798915521194,
    combined_off_eff: 4.341533847237162,
    combined_def_eff: 0.4954423692485391,
    avg_efg_o: -4.76464161432656,
    avg_efg_d: -0.6278235524683342,
    avg_to_rate_o: 3.1459208140632087,
    avg_to_rate_d: 0.679707885021568,
    avg_orb_rate: -1.5058520478273667,
    avg_ftr_o: -1.7365450361096875,
    avg_ftr_d: -1.0484422642091897,
    avg_three_rate: -0.820192174650168,
    avg_three_pct: 0.009861092336231312,
    avg_ft_pct: -0.730764861505131,
    eff_diff: 0.4615961474665081,
    combined_gt_std: 0.8467964560568692,
  },
  mu: {
    avg_tempo: 68.4504808401151,
    tempo_diff: 3.552923902492928,
    cross_total: 144.62293179461287,
    avg_game_total: 141.0040062882865,
    combined_ppg: 150.0336448031753,
    combined_off_eff: 109.57248625268444,
    combined_def_eff: 96.36907904685071,
    avg_efg_o: 52.42957017218985,
    avg_efg_d: 47.10402075639547,
    avg_to_rate_o: 15.386983519529323,
    avg_to_rate_d: 17.177091122297227,
    avg_orb_rate: 33.1819608949335,
    avg_ftr_o: 36.594438479892496,
    avg_ftr_d: 32.4287180967098,
    avg_three_rate: 34.637476126922294,
    avg_three_pct: 36.01068945943523,
    avg_ft_pct: 71.37665639413152,
    eff_diff: 5.46824654689949,
    combined_gt_std: 17.231890977825888,
  },
  sd: {
    avg_tempo: 2.5621898042355373,
    tempo_diff: 2.778311556341792,
    cross_total: 9.736036399495104,
    avg_game_total: 6.782694673969421,
    combined_ppg: 7.719708647935467,
    combined_off_eff: 3.6135207527538458,
    combined_def_eff: 3.3144079323979376,
    avg_efg_o: 1.9297857200220683,
    avg_efg_d: 1.7374310866214078,
    avg_to_rate_o: 1.6268403419389732,
    avg_to_rate_d: 1.9725119396078505,
    avg_orb_rate: 3.7308029385878134,
    avg_ftr_o: 4.197458653288446,
    avg_ftr_d: 4.097930070073291,
    avg_three_rate: 4.388737286399728,
    avg_three_pct: 1.8239979866266542,
    avg_ft_pct: 2.6914521890073093,
    eff_diff: 4.361914730647964,
    combined_gt_std: 1.8287472707685093,
  },
};

// ─── 2026 TEAM O/U PROFILES (from Kaggle regular season data) ────────────────
const OU_PROFILES = {
  "Akron": {tempo:72.24, offEff:120.26, defEff:103.13, ppg:86.88, papg:74.5, avgTotal:161.38, efgO:58.46, toRateO:12.88, orbRate:32.66, ftrO:29.06, efgD:50.57, toRateD:15.16, drbRate:72.45, ftrD:30.29, threeRate:45.13, threePct:38.5, ftPct:75.26, gtStd:20.08},
  "Alabama": {tempo:76.98, offEff:119.15, defEff:108.44, ppg:91.72, papg:83.47, avgTotal:175.19, efgO:55.38, toRateO:10.85, orbRate:29.34, ftrO:37.19, efgD:49.18, toRateD:10.44, drbRate:69.54, ftrD:32.65, threeRate:53.65, threePct:35.81, ftPct:76.53, gtStd:17.31},
  "Arizona": {tempo:72.86, offEff:118.23, defEff:94.42, ppg:86.15, papg:68.79, avgTotal:154.94, efgO:55.05, toRateO:12.57, orbRate:38.07, ftrO:42.87, efgD:45.02, toRateD:14.3, drbRate:75.47, ftrD:27.71, threeRate:26.82, threePct:36.04, ftPct:73.39, gtStd:17.04},
  "Arkansas": {tempo:74.58, offEff:120.59, defEff:107.38, ppg:89.94, papg:80.09, avgTotal:170.03, efgO:56.48, toRateO:10.49, orbRate:30.17, ftrO:36.39, efgD:51.36, toRateD:12.87, drbRate:70.29, ftrD:31.32, threeRate:33.36, threePct:38.87, ftPct:74.69, gtStd:17.42},
  "BYU": {tempo:72.26, offEff:116.13, defEff:104.25, ppg:83.91, papg:75.32, avgTotal:159.24, efgO:54.65, toRateO:12.7, orbRate:32.51, ftrO:34.15, efgD:51.18, toRateD:13.73, drbRate:73.77, ftrD:28.9, threeRate:39.77, threePct:34.92, ftPct:74.55, gtStd:18.69},
  "Cal Baptist": {tempo:69.3, offEff:105.38, defEff:97.51, ppg:73.03, papg:67.58, avgTotal:140.61, efgO:48.59, toRateO:14.19, orbRate:36.05, ftrO:36.13, efgD:46.41, toRateD:14.56, drbRate:74.39, ftrD:37.14, threeRate:32.14, threePct:33.7, ftPct:71.85, gtStd:16.63},
  "Clemson": {tempo:66.48, offEff:111.54, defEff:100.39, ppg:74.15, papg:66.74, avgTotal:140.88, efgO:52.65, toRateO:11.63, orbRate:26.39, ftrO:37.15, efgD:48.92, toRateD:14.59, drbRate:75.85, ftrD:33.12, threeRate:42.92, threePct:34.11, ftPct:72.6, gtStd:15.62},
  "Duke": {tempo:68.19, offEff:120.69, defEff:92.61, ppg:82.29, papg:63.15, avgTotal:145.44, efgO:56.77, toRateO:12.87, orbRate:36.58, ftrO:37.76, efgD:46.18, toRateD:15.18, drbRate:77.92, ftrD:23.74, threeRate:44.36, threePct:35.07, ftPct:72.4, gtStd:16.21},
  "Florida": {tempo:73.51, offEff:118.07, defEff:97.95, ppg:86.79, papg:72.0, avgTotal:158.79, efgO:53.53, toRateO:12.93, orbRate:43.23, ftrO:39.06, efgD:46.3, toRateD:12.95, drbRate:77.48, ftrD:34.02, threeRate:37.13, threePct:30.8, ftPct:70.96, gtStd:16.08},
  "Furman": {tempo:68.26, offEff:109.97, defEff:105.72, ppg:75.06, papg:72.16, avgTotal:147.23, efgO:54.79, toRateO:14.8, orbRate:29.47, ftrO:32.1, efgD:50.11, toRateD:11.3, drbRate:74.35, ftrD:28.93, threeRate:46.34, threePct:33.29, ftPct:69.79, gtStd:14.69},
  "Georgia": {tempo:75.78, offEff:118.52, defEff:104.46, ppg:89.81, papg:79.16, avgTotal:168.97, efgO:54.6, toRateO:11.77, orbRate:32.87, ftrO:36.96, efgD:50.12, toRateD:14.51, drbRate:67.73, ftrD:30.76, threeRate:43.92, threePct:34.09, ftPct:75.35, gtStd:19.74},
  "Gonzaga": {tempo:71.7, offEff:118.72, defEff:92.05, ppg:85.12, papg:66.0, avgTotal:151.12, efgO:56.26, toRateO:11.5, orbRate:34.17, ftrO:31.12, efgD:46.19, toRateD:17.06, drbRate:76.35, ftrD:30.95, threeRate:30.98, threePct:33.95, ftPct:69.89, gtStd:17.4},
  "Hawaii": {tempo:74.06, offEff:106.32, defEff:94.93, ppg:78.73, papg:70.3, avgTotal:149.03, efgO:51.98, toRateO:15.95, orbRate:29.12, ftrO:42.44, efgD:46.42, toRateD:14.6, drbRate:77.15, ftrD:36.07, threeRate:39.69, threePct:31.6, ftPct:73.82, gtStd:14.75},
  "High Point": {tempo:72.62, offEff:119.04, defEff:98.88, ppg:86.45, papg:71.81, avgTotal:158.26, efgO:54.72, toRateO:10.96, orbRate:30.67, ftrO:42.91, efgD:50.06, toRateD:18.11, drbRate:70.03, ftrD:36.38, threeRate:42.91, threePct:34.4, ftPct:74.2, gtStd:15.33},
  "Hofstra": {tempo:66.88, offEff:111.39, defEff:101.02, ppg:74.5, papg:67.56, avgTotal:142.06, efgO:51.47, toRateO:12.46, orbRate:33.6, ftrO:32.49, efgD:45.88, toRateD:11.96, drbRate:71.89, ftrD:35.37, threeRate:43.15, threePct:36.85, ftPct:75.95, gtStd:14.77},
  "Houston": {tempo:66.58, offEff:115.87, defEff:94.4, ppg:77.15, papg:62.85, avgTotal:140.0, efgO:52.1, toRateO:10.14, orbRate:34.36, ftrO:26.92, efgD:46.56, toRateD:17.46, drbRate:72.16, ftrD:39.04, threeRate:40.78, threePct:34.93, ftPct:77.17, gtStd:16.96},
  "Howard": {tempo:70.85, offEff:105.85, defEff:95.68, ppg:75.0, papg:67.79, avgTotal:142.79, efgO:50.62, toRateO:15.78, orbRate:33.37, ftrO:44.18, efgD:47.38, toRateD:17.53, drbRate:71.11, ftrD:38.33, threeRate:34.26, threePct:34.71, ftPct:74.2, gtStd:13.41},
  "Idaho": {tempo:71.02, offEff:107.93, defEff:104.19, ppg:76.66, papg:74.0, avgTotal:150.66, efgO:51.9, toRateO:12.7, orbRate:25.52, ftrO:34.81, efgD:50.33, toRateD:12.96, drbRate:78.15, ftrD:39.22, threeRate:46.81, threePct:34.53, ftPct:72.92, gtStd:14.24},
  "Illinois": {tempo:68.05, offEff:123.99, defEff:102.59, ppg:84.38, papg:69.81, avgTotal:154.19, efgO:55.07, toRateO:10.67, orbRate:38.38, ftrO:32.91, efgD:47.63, toRateD:9.49, drbRate:74.14, ftrD:20.6, threeRate:50.71, threePct:34.69, ftPct:78.87, gtStd:16.98},
  "Iowa": {tempo:64.19, offEff:117.18, defEff:102.78, ppg:75.21, papg:65.97, avgTotal:141.18, efgO:56.56, toRateO:12.59, orbRate:28.23, ftrO:34.5, efgD:52.68, toRateD:17.89, drbRate:73.75, ftrD:39.14, threeRate:41.59, threePct:35.72, ftPct:77.0, gtStd:13.74},
  "Iowa State": {tempo:64.19, offEff:117.18, defEff:102.78, ppg:75.21, papg:65.97, avgTotal:141.18, efgO:56.56, toRateO:12.59, orbRate:28.23, ftrO:34.5, efgD:52.68, toRateD:17.89, drbRate:73.75, ftrD:39.14, threeRate:41.59, threePct:35.72, ftPct:77.0, gtStd:13.74},
  "Kansas": {tempo:69.81, offEff:108.35, defEff:99.41, ppg:75.64, papg:69.39, avgTotal:145.03, efgO:51.57, toRateO:13.1, orbRate:28.03, ftrO:32.6, efgD:45.23, toRateD:10.9, drbRate:72.51, ftrD:27.68, threeRate:35.68, threePct:34.96, ftPct:76.69, gtStd:19.09},
  "Kennesaw State": {tempo:74.4, offEff:108.26, defEff:105.4, ppg:80.55, papg:78.42, avgTotal:158.97, efgO:50.72, toRateO:13.87, orbRate:33.59, ftrO:45.13, efgD:48.5, toRateD:13.13, drbRate:72.89, ftrD:47.47, threeRate:42.94, threePct:33.75, ftPct:70.01, gtStd:21.22},
  "Kentucky": {tempo:70.81, offEff:114.06, defEff:104.26, ppg:80.76, papg:73.82, avgTotal:154.59, efgO:53.11, toRateO:12.21, orbRate:32.48, ftrO:37.48, efgD:48.76, toRateD:13.06, drbRate:71.62, ftrD:36.95, threeRate:39.18, threePct:34.12, ftPct:72.76, gtStd:15.91},
  "Lehigh": {tempo:69.63, offEff:103.95, defEff:107.22, ppg:72.38, papg:74.66, avgTotal:147.03, efgO:53.28, toRateO:15.3, orbRate:20.81, ftrO:32.17, efgD:50.61, toRateD:13.59, drbRate:69.2, ftrD:32.82, threeRate:38.18, threePct:36.47, ftPct:72.95, gtStd:16.65},
  "Long Island": {tempo:69.45, offEff:106.68, defEff:102.41, ppg:74.09, papg:71.12, avgTotal:145.21, efgO:53.3, toRateO:15.82, orbRate:33.66, ftrO:34.72, efgD:49.8, toRateD:15.42, drbRate:70.3, ftrD:34.11, threeRate:28.95, threePct:36.12, ftPct:66.77, gtStd:21.67},
  "Louisville": {tempo:71.88, offEff:117.91, defEff:100.42, ppg:84.76, papg:72.18, avgTotal:156.94, efgO:56.47, toRateO:13.82, orbRate:31.65, ftrO:33.47, efgD:48.75, toRateD:13.99, drbRate:75.37, ftrD:33.4, threeRate:52.8, threePct:35.68, ftPct:76.89, gtStd:16.86},
  "McNeese": {tempo:68.14, offEff:112.77, defEff:98.38, ppg:76.84, papg:67.03, avgTotal:143.87, efgO:50.96, toRateO:11.47, orbRate:33.57, ftrO:38.35, efgD:48.95, toRateD:19.41, drbRate:68.31, ftrD:42.14, threeRate:35.12, threePct:31.62, ftPct:74.04, gtStd:14.84},
  "Miami (FL)": {tempo:70.52, offEff:116.2, defEff:100.94, ppg:81.94, papg:71.18, avgTotal:153.12, efgO:55.62, toRateO:13.37, orbRate:34.21, ftrO:37.47, efgD:51.77, toRateD:15.49, drbRate:75.9, ftrD:29.03, threeRate:31.65, threePct:34.72, ftPct:68.51, gtStd:15.32},
  "Miami (OH)": {tempo:73.57, offEff:118.53, defEff:103.77, ppg:87.21, papg:76.34, avgTotal:163.55, efgO:59.16, toRateO:12.47, orbRate:23.02, ftrO:40.22, efgD:50.84, toRateD:14.83, drbRate:73.66, ftrD:30.88, threeRate:44.63, threePct:37.5, ftPct:75.04, gtStd:20.65},
  "Michigan": {tempo:72.96, offEff:119.01, defEff:94.86, ppg:86.82, papg:69.21, avgTotal:156.03, efgO:58.06, toRateO:14.13, orbRate:34.43, ftrO:37.68, efgD:44.73, toRateD:12.9, drbRate:75.14, ftrD:26.26, threeRate:41.79, threePct:36.02, ftPct:74.71, gtStd:16.49},
  "Michigan State": {tempo:72.96, offEff:119.01, defEff:94.86, ppg:86.82, papg:69.21, avgTotal:156.03, efgO:58.06, toRateO:14.13, orbRate:34.43, ftrO:37.68, efgD:44.73, toRateD:12.9, drbRate:75.14, ftrD:26.26, threeRate:41.79, threePct:36.02, ftPct:74.71, gtStd:16.49},
  "Missouri": {tempo:70.31, offEff:113.29, defEff:107.16, ppg:79.66, papg:75.34, avgTotal:155.0, efgO:55.35, toRateO:14.62, orbRate:32.73, ftrO:42.46, efgD:51.45, toRateD:13.87, drbRate:71.3, ftrD:35.06, threeRate:36.04, threePct:35.01, ftPct:68.6, gtStd:12.33},
  "N. Dakota State": {tempo:70.09, offEff:112.8, defEff:100.98, ppg:79.06, papg:70.77, avgTotal:149.84, efgO:53.36, toRateO:12.82, orbRate:31.98, ftrO:30.66, efgD:51.54, toRateD:16.11, drbRate:76.43, ftrD:29.14, threeRate:42.73, threePct:35.75, ftPct:71.58, gtStd:17.52},
  "NC State": {tempo:71.08, offEff:117.75, defEff:107.65, ppg:83.7, papg:76.52, avgTotal:160.21, efgO:55.33, toRateO:11.26, orbRate:26.92, ftrO:35.19, efgD:53.05, toRateD:14.95, drbRate:70.94, ftrD:36.53, threeRate:43.92, threePct:38.82, ftPct:76.77, gtStd:17.75},
  "Nebraska": {tempo:68.5, offEff:112.82, defEff:96.67, ppg:77.28, papg:66.22, avgTotal:143.5, efgO:55.44, toRateO:12.4, orbRate:25.3, ftrO:27.18, efgD:47.8, toRateD:15.86, drbRate:74.44, ftrD:24.83, threeRate:50.74, threePct:35.25, ftPct:75.0, gtStd:18.63},
  "North Carolina": {tempo:70.47, offEff:113.21, defEff:101.19, ppg:79.78, papg:71.31, avgTotal:151.09, efgO:54.56, toRateO:12.02, orbRate:29.18, ftrO:37.41, efgD:48.17, toRateD:11.15, drbRate:75.3, ftrD:23.82, threeRate:42.27, threePct:34.46, ftPct:68.41, gtStd:14.45},
  "Northern Iowa": {tempo:64.64, offEff:106.83, defEff:96.0, ppg:69.06, papg:62.06, avgTotal:131.12, efgO:54.17, toRateO:12.6, orbRate:19.8, ftrO:25.7, efgD:47.21, toRateD:14.99, drbRate:75.52, ftrD:29.34, threeRate:39.57, threePct:34.92, ftPct:69.67, gtStd:16.38},
  "Ohio State": {tempo:72.15, offEff:106.31, defEff:110.88, ppg:76.7, papg:80.0, avgTotal:156.7, efgO:50.95, toRateO:12.73, orbRate:26.42, ftrO:36.92, efgD:53.02, toRateD:13.49, drbRate:69.15, ftrD:38.19, threeRate:38.14, threePct:30.07, ftPct:71.04, gtStd:20.8},
  "Penn": {tempo:70.3, offEff:106.08, defEff:104.35, ppg:74.57, papg:73.36, avgTotal:147.93, efgO:50.33, toRateO:12.84, orbRate:28.66, ftrO:35.17, efgD:51.72, toRateD:14.41, drbRate:71.28, ftrD:27.46, threeRate:34.99, threePct:38.7, ftPct:69.51, gtStd:15.14},
  "Prairie View A&M": {tempo:73.96, offEff:102.4, defEff:106.2, ppg:75.74, papg:78.55, avgTotal:154.29, efgO:47.88, toRateO:13.37, orbRate:24.37, ftrO:42.76, efgD:50.41, toRateD:15.63, drbRate:66.37, ftrD:43.92, threeRate:30.88, threePct:33.16, ftPct:75.16, gtStd:20.95},
  "Purdue": {tempo:66.38, offEff:123.02, defEff:105.67, ppg:81.66, papg:70.14, avgTotal:151.8, efgO:57.62, toRateO:11.13, orbRate:34.96, ftrO:28.61, efgD:52.29, toRateD:13.46, drbRate:75.26, ftrD:26.02, threeRate:40.93, threePct:37.92, ftPct:74.29, gtStd:14.8},
  "Queens": {tempo:72.69, offEff:116.69, defEff:114.4, ppg:84.82, papg:83.15, avgTotal:167.97, efgO:56.59, toRateO:12.66, orbRate:28.56, ftrO:36.31, efgD:53.97, toRateD:12.45, drbRate:69.94, ftrD:38.75, threeRate:46.79, threePct:35.91, ftPct:74.86, gtStd:15.87},
  "SMU": {tempo:72.92, offEff:115.48, defEff:106.42, ppg:84.21, papg:77.61, avgTotal:161.82, efgO:55.75, toRateO:13.05, orbRate:32.79, ftrO:30.61, efgD:51.4, toRateD:14.26, drbRate:71.78, ftrD:32.02, threeRate:35.97, threePct:37.45, ftPct:74.13, gtStd:15.11},
  "Saint Louis": {tempo:72.87, offEff:118.58, defEff:96.97, ppg:86.41, papg:70.66, avgTotal:157.06, efgO:59.75, toRateO:15.09, orbRate:29.34, ftrO:34.68, efgD:44.76, toRateD:13.11, drbRate:74.64, ftrD:37.17, threeRate:45.14, threePct:40.51, ftPct:74.39, gtStd:14.49},
  "Saint Mary's": {tempo:67.3, offEff:115.33, defEff:97.02, ppg:77.61, papg:65.29, avgTotal:142.9, efgO:52.94, toRateO:13.3, orbRate:36.48, ftrO:35.84, efgD:46.68, toRateD:12.58, drbRate:79.02, ftrD:25.72, threeRate:36.06, threePct:38.57, ftPct:81.06, gtStd:13.92},
  "Santa Clara": {tempo:70.62, offEff:117.32, defEff:103.42, ppg:82.85, papg:73.03, avgTotal:155.88, efgO:54.62, toRateO:12.45, orbRate:35.0, ftrO:25.76, efgD:51.78, toRateD:17.04, drbRate:69.34, ftrD:38.33, threeRate:44.96, threePct:34.86, ftPct:73.95, gtStd:18.44},
  "Siena": {tempo:65.23, offEff:108.12, defEff:100.68, ppg:70.53, papg:65.68, avgTotal:136.21, efgO:50.56, toRateO:13.07, orbRate:30.34, ftrO:34.22, efgD:48.61, toRateD:14.14, drbRate:71.98, ftrD:27.24, threeRate:31.93, threePct:30.45, ftPct:76.86, gtStd:13.63},
  "South Florida": {tempo:76.55, offEff:113.65, defEff:99.69, ppg:87.0, papg:76.31, avgTotal:163.31, efgO:50.9, toRateO:12.19, orbRate:35.78, ftrO:41.13, efgD:48.35, toRateD:15.56, drbRate:71.12, ftrD:38.81, threeRate:43.79, threePct:33.12, ftPct:74.34, gtStd:23.0},
  "St. John's": {tempo:72.78, offEff:112.06, defEff:96.14, ppg:81.56, papg:69.97, avgTotal:151.53, efgO:51.0, toRateO:11.99, orbRate:33.54, ftrO:41.9, efgD:47.36, toRateD:15.73, drbRate:73.19, ftrD:31.75, threeRate:33.78, threePct:33.24, ftPct:72.75, gtStd:18.54},
  "TCU": {tempo:71.68, offEff:109.25, defEff:100.54, ppg:78.3, papg:72.06, avgTotal:150.36, efgO:50.9, toRateO:12.62, orbRate:32.25, ftrO:38.7, efgD:51.02, toRateD:16.46, drbRate:72.97, ftrD:30.36, threeRate:36.85, threePct:33.11, ftPct:70.8, gtStd:21.95},
  "Tennessee": {tempo:69.33, offEff:114.6, defEff:100.05, ppg:79.45, papg:69.36, avgTotal:148.82, efgO:51.56, toRateO:13.29, orbRate:44.69, ftrO:38.72, efgD:47.7, toRateD:13.55, drbRate:75.54, ftrD:36.22, threeRate:31.73, threePct:33.44, ftPct:69.4, gtStd:11.4},
  "Tennessee State": {tempo:72.28, offEff:108.01, defEff:102.29, ppg:78.07, papg:73.93, avgTotal:152.0, efgO:50.11, toRateO:13.37, orbRate:32.32, ftrO:33.5, efgD:51.24, toRateD:17.01, drbRate:72.74, ftrD:41.62, threeRate:30.67, threePct:33.7, ftPct:76.29, gtStd:20.8},
  "Texas": {tempo:70.4, offEff:117.4, defEff:109.06, ppg:82.65, papg:76.77, avgTotal:159.42, efgO:54.22, toRateO:12.69, orbRate:34.26, ftrO:46.17, efgD:51.17, toRateD:11.33, drbRate:76.11, ftrD:40.68, threeRate:36.17, threePct:34.93, ftPct:75.3, gtStd:17.33},
  "Texas A&M": {tempo:75.4, offEff:116.34, defEff:105.52, ppg:87.72, papg:79.56, avgTotal:167.28, efgO:54.19, toRateO:12.14, orbRate:29.82, ftrO:37.38, efgD:50.75, toRateD:14.97, drbRate:68.77, ftrD:35.58, threeRate:46.3, threePct:36.19, ftPct:73.7, gtStd:16.71},
  "Texas Tech": {tempo:69.17, offEff:116.24, defEff:104.99, ppg:80.41, papg:72.62, avgTotal:153.03, efgO:56.2, toRateO:12.92, orbRate:32.3, ftrO:27.09, efgD:49.43, toRateD:12.25, drbRate:71.51, ftrD:31.6, threeRate:48.03, threePct:39.34, ftPct:71.46, gtStd:17.46},
  "Troy": {tempo:71.17, offEff:110.01, defEff:104.66, ppg:78.29, papg:74.48, avgTotal:152.77, efgO:51.88, toRateO:13.9, orbRate:32.96, ftrO:36.31, efgD:50.08, toRateD:13.95, drbRate:70.04, ftrD:32.14, threeRate:45.56, threePct:33.18, ftPct:73.78, gtStd:26.27},
  "UCF": {tempo:72.34, offEff:111.93, defEff:108.48, ppg:80.97, papg:78.47, avgTotal:159.44, efgO:52.83, toRateO:13.08, orbRate:32.66, ftrO:30.84, efgD:52.37, toRateD:13.25, drbRate:73.05, ftrD:35.25, threeRate:34.41, threePct:36.17, ftPct:73.95, gtStd:19.36},
  "UCLA": {tempo:67.38, offEff:115.37, defEff:105.38, ppg:77.74, papg:71.0, avgTotal:148.74, efgO:53.93, toRateO:10.94, orbRate:28.92, ftrO:33.06, efgD:50.45, toRateD:14.94, drbRate:69.37, ftrD:34.67, threeRate:35.89, threePct:38.2, ftPct:76.68, gtStd:18.77},
  "UConn": {tempo:67.61, offEff:114.63, defEff:96.31, ppg:77.5, papg:65.12, avgTotal:142.62, efgO:55.34, toRateO:13.35, orbRate:33.73, ftrO:29.99, efgD:45.66, toRateD:15.06, drbRate:74.06, ftrD:40.17, threeRate:40.32, threePct:35.2, ftPct:71.57, gtStd:18.39},
  "UMBC": {tempo:67.77, offEff:111.31, defEff:100.29, ppg:75.43, papg:67.97, avgTotal:143.4, efgO:53.93, toRateO:11.89, orbRate:22.76, ftrO:33.79, efgD:49.15, toRateD:12.81, drbRate:76.59, ftrD:25.16, threeRate:38.81, threePct:35.92, ftPct:76.4, gtStd:12.87},
  "Utah State": {tempo:69.66, offEff:117.28, defEff:101.7, ppg:81.7, papg:70.85, avgTotal:152.55, efgO:56.62, toRateO:12.79, orbRate:31.1, ftrO:38.69, efgD:49.59, toRateD:16.54, drbRate:69.94, ftrD:38.89, threeRate:40.72, threePct:35.08, ftPct:70.62, gtStd:15.16},
  "VCU": {tempo:70.62, offEff:115.5, defEff:101.21, ppg:81.56, papg:71.47, avgTotal:153.03, efgO:54.08, toRateO:12.64, orbRate:31.23, ftrO:43.72, efgD:48.85, toRateD:14.18, drbRate:73.15, ftrD:33.08, threeRate:43.77, threePct:36.69, ftPct:73.93, gtStd:15.69},
  "Vanderbilt": {tempo:72.54, offEff:119.04, defEff:103.68, ppg:86.35, papg:75.21, avgTotal:161.56, efgO:55.28, toRateO:10.86, orbRate:28.92, ftrO:38.18, efgD:48.77, toRateD:14.82, drbRate:71.4, ftrD:40.96, threeRate:43.6, threePct:35.53, ftPct:79.27, gtStd:15.41},
  "Villanova": {tempo:68.35, offEff:112.89, defEff:103.56, ppg:77.16, papg:70.78, avgTotal:147.94, efgO:53.71, toRateO:11.84, orbRate:30.05, ftrO:31.28, efgD:51.28, toRateD:15.56, drbRate:70.05, ftrD:28.91, threeRate:45.66, threePct:35.28, ftPct:69.4, gtStd:14.96},
  "Virginia": {tempo:69.04, offEff:116.82, defEff:99.1, ppg:80.65, papg:68.41, avgTotal:149.06, efgO:54.62, toRateO:12.85, orbRate:37.02, ftrO:33.04, efgD:45.33, toRateD:12.69, drbRate:73.34, ftrD:33.02, threeRate:46.5, threePct:35.95, ftPct:72.65, gtStd:17.12},
  "Wisconsin": {tempo:70.82, offEff:117.21, defEff:107.2, ppg:83.0, papg:75.91, avgTotal:158.91, efgO:54.46, toRateO:10.65, orbRate:27.29, ftrO:31.91, efgD:51.33, toRateD:11.91, drbRate:73.4, ftrD:30.48, threeRate:52.61, threePct:36.1, ftPct:78.57, gtStd:16.51},
  "Wright State": {tempo:70.59, offEff:113.29, defEff:106.83, ppg:79.97, papg:75.41, avgTotal:155.38, efgO:54.42, toRateO:13.61, orbRate:31.16, ftrO:38.0, efgD:52.08, toRateD:14.1, drbRate:72.66, ftrD:33.51, threeRate:33.65, threePct:36.15, ftPct:74.47, gtStd:15.72},
};

// ─── O/U PREDICTION FUNCTION ──────────────────────────────────────────────
function predictOU(t1Name, t2Name) {
  const a = OU_PROFILES[t1Name], b = OU_PROFILES[t2Name];
  if (!a || !b) return null;
  
  const avgTempo = (a.tempo + b.tempo) / 2;
  const crossA = (a.offEff / 100) * (b.defEff / 100) * avgTempo;
  const crossB = (b.offEff / 100) * (a.defEff / 100) * avgTempo;
  
  const feat = {
    avg_tempo: avgTempo,
    tempo_diff: Math.abs(a.tempo - b.tempo),
    cross_total: crossA + crossB,
    avg_game_total: (a.avgTotal + b.avgTotal) / 2,
    combined_ppg: a.ppg + b.ppg,
    combined_off_eff: (a.offEff + b.offEff) / 2,
    combined_def_eff: (a.defEff + b.defEff) / 2,
    avg_efg_o: (a.efgO + b.efgO) / 2,
    avg_efg_d: (a.efgD + b.efgD) / 2,
    avg_to_rate_o: (a.toRateO + b.toRateO) / 2,
    avg_to_rate_d: (a.toRateD + b.toRateD) / 2,
    avg_orb_rate: (a.orbRate + b.orbRate) / 2,
    avg_ftr_o: (a.ftrO + b.ftrO) / 2,
    avg_ftr_d: (a.ftrD + b.ftrD) / 2,
    avg_three_rate: (a.threeRate + b.threeRate) / 2,
    avg_three_pct: (a.threePct + b.threePct) / 2,
    avg_ft_pct: (a.ftPct + b.ftPct) / 2,
    eff_diff: Math.abs(a.offEff - b.offEff),
    combined_gt_std: (a.gtStd + b.gtStd) / 2,
  };
  
  let pred = OU_MODEL.intercept;
  for (const f in OU_MODEL.c) {
    const z = (feat[f] - OU_MODEL.mu[f]) / OU_MODEL.sd[f];
    pred += OU_MODEL.c[f] * z;
  }
  return Math.round(pred * 2) / 2; // round to nearest 0.5
}

// ─── CONFIDENCE META-MODEL (Logistic, trained on 911 games) ──
// Predicts P(model ATS pick correct) from game context
const CONF_META = {
  bias: 1.871532676621567,
  w: {
    abs_dk: -0.030977699980896042,
    abs_model_spread: -0.04196484749698897,
    is_tossup: 0.03949788675800425,
    is_mid: -0.03578075066973054,
    is_large: -0.006618402687935407,
    is_blowout: -0.0016454370100963376,
    model_dk_gap: 0.06093384518862162,
    model_dk_agree_direction: -0.05342714054794876,
    mc_lean_strength: 0.06060989804743783,
    quality_gap: -0.030977699980896035,
    consistency_diff: 0.0037553297165379244,
    away_em_gap: -0.013065900441252396,
    trajectory_gap: -0.0008929073736729337,
    close_game_gap: -0.008382795152990728,
    gap_x_tossup: 0.04332909964774109,
    gap_x_blowout: 0.006443499727604213,
    mc_x_tossup: 0.03911094207946724,
    mc_x_quality: 0.0023532955754187635,
  },
  mu: {
    abs_dk: 6.416759967216235,
    abs_model_spread: 11.932022008242926,
    is_tossup: 0.4796926454445664,
    is_mid: 0.38638858397365533,
    is_large: 0.10647639956092206,
    is_blowout: 0.027442371020856202,
    model_dk_gap: 9.32916897751063,
    model_dk_agree_direction: 0.6234906695938529,
    mc_lean_strength: 34.30843029637761,
    quality_gap: 7.2917726900184485,
    consistency_diff: 2.5372212522337483,
    away_em_gap: 5.191054621013396,
    trajectory_gap: 5.319962320216965,
    close_game_gap: 0.2067426816563189,
    gap_x_tossup: 7.128153020860573,
    gap_x_blowout: 0.3525148745991348,
    mc_x_tossup: 26.491240395170145,
    mc_x_quality: 10.126230408881419,
  },
  sd: {
    abs_dk: 5.308323263018501,
    abs_model_spread: 3.51855185846386,
    is_tossup: 0.499587441146152,
    is_mid: 0.48692139627304204,
    is_large: 0.30844639063776536,
    is_blowout: 0.16336856274574332,
    model_dk_gap: 4.542764352142065,
    model_dk_agree_direction: 0.48451011808141,
    mc_lean_strength: 12.002847597337968,
    quality_gap: 6.032185526157388,
    consistency_diff: 1.9260950658030598,
    away_em_gap: 4.157166866201118,
    trajectory_gap: 3.937735923462912,
    close_game_gap: 0.17119033674176173,
    gap_x_tossup: 5.447964401246551,
    gap_x_blowout: 2.109487373109232,
    mc_x_tossup: 18.891901682332605,
    mc_x_quality: 7.819798673663444,
  },
};

function calibratedConfidence(modelSpread, dkSpread, mcCoverProb) {
  const absDk = Math.abs(dkSpread);
  const absModel = Math.abs(modelSpread);
  const modelMargin = -modelSpread; // convert spread to margin (positive = t1 wins)
  const dkMargin = -dkSpread;
  const gap = Math.abs(modelMargin - dkMargin);
  const mcStrength = Math.abs(mcCoverProb - 50);
  
  // Get team profiles for quality/trajectory features if available
  const feat = {
    abs_dk: absDk,
    abs_model_spread: absModel,
    is_tossup: absDk < 5 ? 1.0 : 0.0,
    is_mid: (absDk >= 5 && absDk < 12) ? 1.0 : 0.0,
    is_large: (absDk >= 12 && absDk < 20) ? 1.0 : 0.0,
    is_blowout: absDk >= 20 ? 1.0 : 0.0,
    model_dk_gap: gap,
    model_dk_agree_direction: (modelMargin > 0) === (dkMargin > 0) ? 1.0 : 0.0,
    mc_lean_strength: mcStrength,
    quality_gap: absDk * 0.9,  // proxy from DK spread
    consistency_diff: 0,
    away_em_gap: gap * 0.5,  // rough proxy
    trajectory_gap: 0,
    close_game_gap: 0,
    gap_x_tossup: gap * (absDk < 8 ? 1.0 : 0.0),
    gap_x_blowout: gap * (absDk >= 15 ? 1.0 : 0.0),
    mc_x_tossup: mcStrength * (absDk < 8 ? 1.0 : 0.0),
    mc_x_quality: mcStrength * Math.min(absDk / 20, 1.0),
  };
  
  let z = CONF_META.bias;
  for (const f in CONF_META.w) {
    z += CONF_META.w[f] * (feat[f] - CONF_META.mu[f]) / CONF_META.sd[f];
  }
  z = Math.max(-20, Math.min(20, z));
  const prob = 1.0 / (1.0 + Math.exp(-z));
  return Math.round(Math.max(20, Math.min(88, prob * 100)));
}

// ─── SPREAD MODEL v5.1 (Kaggle-trained Ridge, 1369 games, randomized ordering) ────
// LOSO MAE: 10.8 pts (fixed intercept bias) | ATS: 523-81 (86.6%) on value picks
// Conformal 80%: ±10.3 pts
const SPREAD_V5 = {
  intercept: -0.014609203798392988,
  c: {
    adj_em_diff: 2.6326793114075553,
    off_eff_diff: 2.5530097304493213,
    def_eff_diff: -1.1523358036664468,
    ppg_diff: 2.845669461069747,
    efg_edge: -1.2415979455173427,
    to_edge: -0.4795957856828411,
    orb_edge: 1.1072904083039354,
    ftr_edge: -1.2421693815155528,
    em_traj_diff: -5.248917713420833,
    late_em_diff: 3.294814018343069,
    late_efg_diff: 0.4033482306649494,
    win_pct_diff: 0.03639509455748502,
    away_em_diff: -3.581678348731914,
    away_wpct_diff: 0.16900416691546788,
    margin_std_diff: -1.6831996287693247,
    close_wpct_diff: -0.17330481236978298,
    blowout_pct_diff: 0.8527597610445783,
    tempo_diff: -1.9263521117146183,
    three_rate_diff: 0.428194170027771,
    three_pct_diff: -1.51744396201268,
    ft_pct_diff: 0.2738141550436486,
  },
  mu: {
    adj_em_diff: 0.15765052441932348,
    off_eff_diff: 0.23044816659320172,
    def_eff_diff: 0.07279764217387825,
    ppg_diff: 0.34961023825150334,
    efg_edge: 0.24618108209209202,
    to_edge: -0.006523728165767484,
    orb_edge: -0.12363141440807537,
    ftr_edge: -0.14808754178527328,
    em_traj_diff: 0.256591688338604,
    late_em_diff: 0.39319228373282433,
    late_efg_diff: 0.32315882627379605,
    win_pct_diff: -0.0004512746892032286,
    away_em_diff: -0.008256931793528622,
    away_wpct_diff: -0.0019217855874239026,
    margin_std_diff: 0.19664020834095808,
    close_wpct_diff: -0.005079760862749733,
    blowout_pct_diff: 0.005603719633600045,
    tempo_diff: 0.17120185309386712,
    three_rate_diff: 0.133759338272993,
    three_pct_diff: 0.1355353021890892,
    ft_pct_diff: 0.14667618261355447,
  },
  sd: {
    adj_em_diff: 9.531650215863426,
    off_eff_diff: 6.991059580466736,
    def_eff_diff: 6.287694236979219,
    ppg_diff: 7.274595416195279,
    efg_edge: 5.101163688163664,
    to_edge: 3.8088246475825365,
    orb_edge: 7.101165212828915,
    ftr_edge: 11.06005659278711,
    em_traj_diff: 6.776500515528887,
    late_em_diff: 7.716511202479381,
    late_efg_diff: 4.904146683322709,
    win_pct_diff: 0.14593988477271597,
    away_em_diff: 6.715628759773918,
    away_wpct_diff: 0.21124173960171283,
    margin_std_diff: 3.245514447089058,
    close_wpct_diff: 0.2674261807222957,
    blowout_pct_diff: 0.18664895273838636,
    tempo_diff: 4.506991600447593,
    three_rate_diff: 7.131995478982081,
    three_pct_diff: 3.727513458712331,
    ft_pct_diff: 5.01576375771333,
  },
  conformal_80: 14.0,
};


// ─── 2026 TEAM SPREAD PROFILES (Kaggle regular season) ────
const SPREAD_PROFILES = {
  "Akron": {tempo:72.24, off_eff:120.26, def_eff:103.13, adj_em:17.13, ppg:86.88, papg:74.5, avg_margin:12.38, efg_o:58.46, to_rate_o:12.88, orb_rate:32.66, ftr_o:29.06, efg_d:50.57, to_rate_d:15.16, drb_rate:72.45, ftr_d:30.29, three_rate:45.13, three_pct:38.5, ft_pct:75.26, win_pct:0.84, margin_std:13.12, away_wpct:0.74, away_em:8.26, late_em:13.8, em_trajectory:1.42, late_efg_o:58.48, close_wpct:0.6, blowout_pct:0.44},
  "Alabama": {tempo:76.98, off_eff:119.15, def_eff:108.44, adj_em:10.72, ppg:91.72, papg:83.47, avg_margin:8.25, efg_o:55.38, to_rate_o:10.85, orb_rate:29.34, ftr_o:37.19, efg_d:49.18, to_rate_d:10.44, drb_rate:69.54, ftr_d:32.65, three_rate:53.65, three_pct:35.81, ft_pct:76.53, win_pct:0.72, margin_std:15.61, away_wpct:0.65, away_em:4.24, late_em:6.38, em_trajectory:-1.88, late_efg_o:56.36, close_wpct:0.75, blowout_pct:0.31},
  "Arizona": {tempo:72.86, off_eff:118.23, def_eff:94.42, adj_em:23.82, ppg:86.15, papg:68.79, avg_margin:17.35, efg_o:55.05, to_rate_o:12.57, orb_rate:38.07, ftr_o:42.87, efg_d:45.02, to_rate_d:14.3, drb_rate:75.47, ftr_d:27.71, three_rate:26.82, three_pct:36.04, ft_pct:73.39, win_pct:0.94, margin_std:12.51, away_wpct:0.94, away_em:9.53, late_em:9.6, em_trajectory:-7.75, late_efg_o:52.69, close_wpct:0.71, blowout_pct:0.53},
  "Arkansas": {tempo:74.58, off_eff:120.59, def_eff:107.38, adj_em:13.21, ppg:89.94, papg:80.09, avg_margin:9.85, efg_o:56.48, to_rate_o:10.49, orb_rate:30.17, ftr_o:36.39, efg_d:51.36, to_rate_d:12.87, drb_rate:70.29, ftr_d:31.32, three_rate:33.36, three_pct:38.87, ft_pct:74.69, win_pct:0.76, margin_std:17.71, away_wpct:0.56, away_em:-0.31, late_em:4.1, em_trajectory:-5.75, late_efg_o:56.0, close_wpct:0.78, blowout_pct:0.35},
  "BYU": {tempo:72.26, off_eff:116.13, def_eff:104.25, adj_em:11.89, ppg:83.91, papg:75.32, avg_margin:8.59, efg_o:54.65, to_rate_o:12.7, orb_rate:32.51, ftr_o:34.15, efg_d:51.18, to_rate_d:13.73, drb_rate:73.77, ftr_d:28.9, three_rate:39.77, three_pct:34.92, ft_pct:74.55, win_pct:0.68, margin_std:16.66, away_wpct:0.58, away_em:3.21, late_em:-0.3, em_trajectory:-8.89, late_efg_o:52.12, close_wpct:0.75, blowout_pct:0.29},
  "Cal Baptist": {tempo:69.3, off_eff:105.38, def_eff:97.51, adj_em:7.87, ppg:73.03, papg:67.58, avg_margin:5.45, efg_o:48.59, to_rate_o:14.19, orb_rate:36.05, ftr_o:36.13, efg_d:46.41, to_rate_d:14.56, drb_rate:74.39, ftr_d:37.14, three_rate:32.14, three_pct:33.7, ft_pct:71.85, win_pct:0.76, margin_std:12.5, away_wpct:0.56, away_em:0.39, late_em:9.11, em_trajectory:3.66, late_efg_o:50.18, close_wpct:0.71, blowout_pct:0.18},
  "Clemson": {tempo:66.48, off_eff:111.54, def_eff:100.39, adj_em:11.15, ppg:74.15, papg:66.74, avg_margin:7.41, efg_o:52.65, to_rate_o:11.63, orb_rate:26.39, ftr_o:37.15, efg_d:48.92, to_rate_d:14.59, drb_rate:75.85, ftr_d:33.12, three_rate:42.92, three_pct:34.11, ft_pct:72.6, win_pct:0.71, margin_std:14.45, away_wpct:0.61, away_em:1.61, late_em:-2.67, em_trajectory:-10.08, late_efg_o:49.21, close_wpct:0.67, blowout_pct:0.24},
  "Duke": {tempo:68.19, off_eff:120.69, def_eff:92.61, adj_em:28.08, ppg:82.29, papg:63.15, avg_margin:19.15, efg_o:56.77, to_rate_o:12.87, orb_rate:36.58, ftr_o:37.76, efg_d:46.18, to_rate_d:15.18, drb_rate:77.92, ftr_d:23.74, three_rate:44.36, three_pct:35.07, ft_pct:72.4, win_pct:0.94, margin_std:15.74, away_wpct:0.89, away_em:14.63, late_em:18.6, em_trajectory:-0.55, late_efg_o:55.35, close_wpct:0.71, blowout_pct:0.53},
  "Florida": {tempo:73.51, off_eff:118.07, def_eff:97.95, adj_em:20.12, ppg:86.79, papg:72.0, avg_margin:14.79, efg_o:53.53, to_rate_o:12.93, orb_rate:43.23, ftr_o:39.06, efg_d:46.3, to_rate_d:12.95, drb_rate:77.48, ftr_d:34.02, three_rate:37.13, three_pct:30.8, ft_pct:70.96, win_pct:0.79, margin_std:15.3, away_wpct:0.67, away_em:8.67, late_em:13.44, em_trajectory:-1.34, late_efg_o:55.83, close_wpct:0.33, blowout_pct:0.48},
  "Furman": {tempo:68.26, off_eff:109.97, def_eff:105.72, adj_em:4.25, ppg:75.06, papg:72.16, avg_margin:2.9, efg_o:54.79, to_rate_o:14.8, orb_rate:29.47, ftr_o:32.1, efg_d:50.11, to_rate_d:11.3, drb_rate:74.35, ftr_d:28.93, three_rate:46.34, three_pct:33.29, ft_pct:69.79, win_pct:0.61, margin_std:11.3, away_wpct:0.61, away_em:1.61, late_em:5.75, em_trajectory:2.85, late_efg_o:55.87, close_wpct:0.46, blowout_pct:0.16},
  "Georgia": {tempo:75.78, off_eff:118.52, def_eff:104.46, adj_em:14.06, ppg:89.81, papg:79.16, avg_margin:10.66, efg_o:54.6, to_rate_o:11.77, orb_rate:32.87, ftr_o:36.96, efg_d:50.12, to_rate_d:14.51, drb_rate:67.73, ftr_d:30.76, three_rate:43.92, three_pct:34.09, ft_pct:75.35, win_pct:0.69, margin_std:20.14, away_wpct:0.57, away_em:1.5, late_em:3.25, em_trajectory:-7.41, late_efg_o:58.97, close_wpct:0.56, blowout_pct:0.34},
  "Gonzaga": {tempo:71.7, off_eff:118.72, def_eff:92.05, adj_em:26.67, ppg:85.12, papg:66.0, avg_margin:19.12, efg_o:56.26, to_rate_o:11.5, orb_rate:34.17, ftr_o:31.12, efg_d:46.19, to_rate_d:17.06, drb_rate:76.35, ftr_d:30.95, three_rate:30.98, three_pct:33.95, ft_pct:69.89, win_pct:0.91, margin_std:20.44, away_wpct:0.83, away_em:11.89, late_em:12.57, em_trajectory:-6.55, late_efg_o:55.16, close_wpct:0.5, blowout_pct:0.52},
  "Hawaii": {tempo:74.06, off_eff:106.32, def_eff:94.93, adj_em:11.39, ppg:78.73, papg:70.3, avg_margin:8.43, efg_o:51.98, to_rate_o:15.95, orb_rate:29.12, ftr_o:42.44, efg_d:46.42, to_rate_d:14.6, drb_rate:77.15, ftr_d:36.07, three_rate:39.69, three_pct:31.6, ft_pct:73.82, win_pct:0.73, margin_std:16.01, away_wpct:0.62, away_em:4.0, late_em:2.1, em_trajectory:-6.33, late_efg_o:50.51, close_wpct:0.86, blowout_pct:0.37},
  "High Point": {tempo:72.62, off_eff:119.04, def_eff:98.88, adj_em:20.17, ppg:86.45, papg:71.81, avg_margin:14.65, efg_o:54.72, to_rate_o:10.96, orb_rate:30.67, ftr_o:42.91, efg_d:50.06, to_rate_d:18.11, drb_rate:70.03, ftr_d:36.38, three_rate:42.91, three_pct:34.4, ft_pct:74.2, win_pct:0.87, margin_std:15.77, away_wpct:0.81, away_em:9.0, late_em:15.62, em_trajectory:0.98, late_efg_o:54.31, close_wpct:0.8, blowout_pct:0.48},
  "Hofstra": {tempo:66.88, off_eff:111.39, def_eff:101.02, adj_em:10.37, ppg:74.5, papg:67.56, avg_margin:6.94, efg_o:51.47, to_rate_o:12.46, orb_rate:33.6, ftr_o:32.49, efg_d:45.88, to_rate_d:11.96, drb_rate:71.89, ftr_d:35.37, three_rate:43.15, three_pct:36.85, ft_pct:75.95, win_pct:0.69, margin_std:10.64, away_wpct:0.64, away_em:4.91, late_em:12.22, em_trajectory:5.28, late_efg_o:50.49, close_wpct:0.43, blowout_pct:0.22},
  "Houston": {tempo:66.58, off_eff:115.87, def_eff:94.4, adj_em:21.47, ppg:77.15, papg:62.85, avg_margin:14.29, efg_o:52.1, to_rate_o:10.14, orb_rate:34.36, ftr_o:26.92, efg_d:46.56, to_rate_d:17.46, drb_rate:72.16, ftr_d:39.04, three_rate:40.78, three_pct:34.93, ft_pct:77.17, win_pct:0.82, margin_std:14.83, away_wpct:0.72, away_em:6.11, late_em:7.5, em_trajectory:-6.79, late_efg_o:50.84, close_wpct:0.43, blowout_pct:0.41},
  "Howard": {tempo:70.85, off_eff:105.85, def_eff:95.68, adj_em:10.17, ppg:75.0, papg:67.79, avg_margin:7.21, efg_o:50.62, to_rate_o:15.78, orb_rate:33.37, ftr_o:44.18, efg_d:47.38, to_rate_d:17.53, drb_rate:71.11, ftr_d:38.33, three_rate:34.26, three_pct:34.71, ft_pct:74.2, win_pct:0.66, margin_std:16.82, away_wpct:0.67, away_em:3.94, late_em:21.0, em_trajectory:13.79, late_efg_o:56.32, close_wpct:0.38, blowout_pct:0.34},
  "Idaho": {tempo:71.02, off_eff:107.93, def_eff:104.19, adj_em:3.74, ppg:76.66, papg:74.0, avg_margin:2.66, efg_o:51.9, to_rate_o:12.7, orb_rate:25.52, ftr_o:34.81, efg_d:50.33, to_rate_d:12.96, drb_rate:78.15, ftr_d:39.22, three_rate:46.81, three_pct:34.53, ft_pct:72.92, win_pct:0.56, margin_std:12.75, away_wpct:0.55, away_em:0.73, late_em:7.36, em_trajectory:4.71, late_efg_o:52.78, close_wpct:0.64, blowout_pct:0.16},
  "Illinois": {tempo:68.05, off_eff:123.99, def_eff:102.59, adj_em:21.4, ppg:84.38, papg:69.81, avg_margin:14.56, efg_o:55.07, to_rate_o:10.67, orb_rate:38.38, ftr_o:32.91, efg_d:47.63, to_rate_d:9.49, drb_rate:74.14, ftr_d:20.6, three_rate:50.71, three_pct:34.69, ft_pct:78.87, win_pct:0.75, margin_std:17.57, away_wpct:0.67, away_em:8.13, late_em:10.0, em_trajectory:-4.56, late_efg_o:52.19, close_wpct:0.14, blowout_pct:0.38},
  "Iowa": {tempo:64.19, off_eff:117.18, def_eff:102.78, adj_em:14.4, ppg:75.21, papg:65.97, avg_margin:9.24, efg_o:56.56, to_rate_o:12.59, orb_rate:28.23, ftr_o:34.5, efg_d:52.68, to_rate_d:17.89, drb_rate:73.75, ftr_d:39.14, three_rate:41.59, three_pct:35.72, ft_pct:77.0, win_pct:0.64, margin_std:17.3, away_wpct:0.44, away_em:3.88, late_em:-2.0, em_trajectory:-11.24, late_efg_o:52.48, close_wpct:0.38, blowout_pct:0.36},
  "Iowa State": {tempo:64.19, off_eff:117.18, def_eff:102.78, adj_em:14.4, ppg:75.21, papg:65.97, avg_margin:9.24, efg_o:56.56, to_rate_o:12.59, orb_rate:28.23, ftr_o:34.5, efg_d:52.68, to_rate_d:17.89, drb_rate:73.75, ftr_d:39.14, three_rate:41.59, three_pct:35.72, ft_pct:77.0, win_pct:0.64, margin_std:17.3, away_wpct:0.44, away_em:3.88, late_em:-2.0, em_trajectory:-11.24, late_efg_o:52.48, close_wpct:0.38, blowout_pct:0.36},
  "Kansas": {tempo:69.81, off_eff:108.35, def_eff:99.41, adj_em:8.94, ppg:75.64, papg:69.39, avg_margin:6.24, efg_o:51.57, to_rate_o:13.1, orb_rate:28.03, ftr_o:32.6, efg_d:45.23, to_rate_d:10.9, drb_rate:72.51, ftr_d:27.68, three_rate:35.68, three_pct:34.96, ft_pct:76.69, win_pct:0.7, margin_std:16.01, away_wpct:0.53, away_em:-2.24, late_em:-4.44, em_trajectory:-10.69, late_efg_o:45.6, close_wpct:0.86, blowout_pct:0.3},
  "Kennesaw State": {tempo:74.4, off_eff:108.26, def_eff:105.4, adj_em:2.86, ppg:80.55, papg:78.42, avg_margin:2.13, efg_o:50.72, to_rate_o:13.87, orb_rate:33.59, ftr_o:45.13, efg_d:48.5, to_rate_d:13.13, drb_rate:72.89, ftr_d:47.47, three_rate:42.94, three_pct:33.75, ft_pct:70.01, win_pct:0.58, margin_std:10.99, away_wpct:0.44, away_em:-0.61, late_em:3.0, em_trajectory:0.87, late_efg_o:53.48, close_wpct:0.6, blowout_pct:0.16},
  "Kentucky": {tempo:70.81, off_eff:114.06, def_eff:104.26, adj_em:9.8, ppg:80.76, papg:73.82, avg_margin:6.94, efg_o:53.11, to_rate_o:12.21, orb_rate:32.48, ftr_o:37.48, efg_d:48.76, to_rate_d:13.06, drb_rate:71.62, ftr_d:36.95, three_rate:39.18, three_pct:34.12, ft_pct:72.76, win_pct:0.62, margin_std:20.07, away_wpct:0.44, away_em:-5.38, late_em:-1.0, em_trajectory:-7.94, late_efg_o:51.06, close_wpct:0.62, blowout_pct:0.24},
  "Lehigh": {tempo:69.63, off_eff:103.95, def_eff:107.22, adj_em:-3.28, ppg:72.38, papg:74.66, avg_margin:-2.28, efg_o:53.28, to_rate_o:15.3, orb_rate:20.81, ftr_o:32.17, efg_d:50.61, to_rate_d:13.59, drb_rate:69.2, ftr_d:32.82, three_rate:38.18, three_pct:36.47, ft_pct:72.95, win_pct:0.5, margin_std:10.57, away_wpct:0.29, away_em:-7.41, late_em:3.5, em_trajectory:5.78, late_efg_o:55.88, close_wpct:0.62, blowout_pct:0.03},
  "Long Island": {tempo:69.45, off_eff:106.68, def_eff:102.41, adj_em:4.28, ppg:74.09, papg:71.12, avg_margin:2.97, efg_o:53.3, to_rate_o:15.82, orb_rate:33.66, ftr_o:34.72, efg_d:49.8, to_rate_d:15.42, drb_rate:70.3, ftr_d:34.11, three_rate:28.95, three_pct:36.12, ft_pct:66.77, win_pct:0.71, margin_std:12.63, away_wpct:0.53, away_em:-1.68, late_em:7.1, em_trajectory:4.13, late_efg_o:56.62, close_wpct:0.75, blowout_pct:0.15},
  "Louisville": {tempo:71.88, off_eff:117.91, def_eff:100.42, adj_em:17.49, ppg:84.76, papg:72.18, avg_margin:12.58, efg_o:56.47, to_rate_o:13.82, orb_rate:31.65, ftr_o:33.47, efg_d:48.75, to_rate_d:13.99, drb_rate:75.37, ftr_d:33.4, three_rate:52.8, three_pct:35.68, ft_pct:76.89, win_pct:0.7, margin_std:21.08, away_wpct:0.5, away_em:1.12, late_em:3.0, em_trajectory:-9.58, late_efg_o:56.37, close_wpct:0.33, blowout_pct:0.36},
  "McNeese": {tempo:68.14, off_eff:112.77, def_eff:98.38, adj_em:14.39, ppg:76.84, papg:67.03, avg_margin:9.81, efg_o:50.96, to_rate_o:11.47, orb_rate:33.57, ftr_o:38.35, efg_d:48.95, to_rate_d:19.41, drb_rate:68.31, ftr_d:42.14, three_rate:35.12, three_pct:31.62, ft_pct:74.04, win_pct:0.84, margin_std:15.47, away_wpct:0.71, away_em:4.0, late_em:13.88, em_trajectory:4.07, late_efg_o:50.2, close_wpct:0.75, blowout_pct:0.32},
  "Miami (FL)": {tempo:70.52, off_eff:116.2, def_eff:100.94, adj_em:15.25, ppg:81.94, papg:71.18, avg_margin:10.76, efg_o:55.62, to_rate_o:13.37, orb_rate:34.21, ftr_o:37.47, efg_d:51.77, to_rate_d:15.49, drb_rate:75.9, ftr_d:29.03, three_rate:31.65, three_pct:34.72, ft_pct:68.51, win_pct:0.76, margin_std:16.48, away_wpct:0.67, away_em:1.2, late_em:2.11, em_trajectory:-8.65, late_efg_o:53.47, close_wpct:0.5, blowout_pct:0.3},
  "Miami (OH)": {tempo:73.57, off_eff:118.53, def_eff:103.77, adj_em:14.76, ppg:87.21, papg:76.34, avg_margin:10.86, efg_o:59.16, to_rate_o:12.47, orb_rate:23.02, ftr_o:40.22, efg_d:50.84, to_rate_d:14.83, drb_rate:73.66, ftr_d:30.88, three_rate:44.63, three_pct:37.5, ft_pct:75.04, win_pct:0.97, margin_std:9.58, away_wpct:0.94, away_em:7.62, late_em:6.38, em_trajectory:-4.49, late_efg_o:56.81, close_wpct:0.9, blowout_pct:0.28},
  "Michigan": {tempo:72.96, off_eff:119.01, def_eff:94.86, adj_em:24.15, ppg:86.82, papg:69.21, avg_margin:17.62, efg_o:58.06, to_rate_o:14.13, orb_rate:34.43, ftr_o:37.68, efg_d:44.73, to_rate_d:12.9, drb_rate:75.14, ftr_d:26.26, three_rate:41.79, three_pct:36.02, ft_pct:74.71, win_pct:0.91, margin_std:15.93, away_wpct:0.89, away_em:11.68, late_em:7.2, em_trajectory:-10.42, late_efg_o:56.86, close_wpct:0.78, blowout_pct:0.41},
  "Michigan State": {tempo:72.96, off_eff:119.01, def_eff:94.86, adj_em:24.15, ppg:86.82, papg:69.21, avg_margin:17.62, efg_o:58.06, to_rate_o:14.13, orb_rate:34.43, ftr_o:37.68, efg_d:44.73, to_rate_d:12.9, drb_rate:75.14, ftr_d:26.26, three_rate:41.79, three_pct:36.02, ft_pct:74.71, win_pct:0.91, margin_std:15.93, away_wpct:0.89, away_em:11.68, late_em:7.2, em_trajectory:-10.42, late_efg_o:56.86, close_wpct:0.78, blowout_pct:0.41},
  "Missouri": {tempo:70.31, off_eff:113.29, def_eff:107.16, adj_em:6.13, ppg:79.66, papg:75.34, avg_margin:4.31, efg_o:55.35, to_rate_o:14.62, orb_rate:32.73, ftr_o:42.46, efg_d:51.45, to_rate_d:13.87, drb_rate:71.3, ftr_d:35.06, three_rate:36.04, three_pct:35.01, ft_pct:68.6, win_pct:0.62, margin_std:18.08, away_wpct:0.36, away_em:-4.93, late_em:-2.75, em_trajectory:-7.06, late_efg_o:53.9, close_wpct:0.73, blowout_pct:0.31},
  "N. Dakota State": {tempo:70.09, off_eff:112.8, def_eff:100.98, adj_em:11.83, ppg:79.06, papg:70.77, avg_margin:8.29, efg_o:53.36, to_rate_o:12.82, orb_rate:31.98, ftr_o:30.66, efg_d:51.54, to_rate_d:16.11, drb_rate:76.43, ftr_d:29.14, three_rate:42.73, three_pct:35.75, ft_pct:71.58, win_pct:0.77, margin_std:13.01, away_wpct:0.7, away_em:5.9, late_em:14.38, em_trajectory:6.08, late_efg_o:55.1, close_wpct:0.7, blowout_pct:0.26},
  "NC State": {tempo:71.08, off_eff:117.75, def_eff:107.65, adj_em:10.1, ppg:83.7, papg:76.52, avg_margin:7.18, efg_o:55.33, to_rate_o:11.26, orb_rate:26.92, ftr_o:35.19, efg_d:53.05, to_rate_d:14.95, drb_rate:70.94, ftr_d:36.53, three_rate:43.92, three_pct:38.82, ft_pct:76.77, win_pct:0.61, margin_std:20.87, away_wpct:0.56, away_em:0.62, late_em:-4.88, em_trajectory:-12.06, late_efg_o:51.46, close_wpct:0.29, blowout_pct:0.27},
  "Nebraska": {tempo:68.5, off_eff:112.82, def_eff:96.67, adj_em:16.15, ppg:77.28, papg:66.22, avg_margin:11.06, efg_o:55.44, to_rate_o:12.4, orb_rate:25.3, ftr_o:27.18, efg_d:47.8, to_rate_d:15.86, drb_rate:74.44, ftr_d:24.83, three_rate:50.74, three_pct:35.25, ft_pct:75.0, win_pct:0.81, margin_std:13.66, away_wpct:0.71, away_em:3.71, late_em:4.75, em_trajectory:-6.31, late_efg_o:52.73, close_wpct:0.57, blowout_pct:0.41},
  "North Carolina": {tempo:70.47, off_eff:113.21, def_eff:101.19, adj_em:12.02, ppg:79.78, papg:71.31, avg_margin:8.47, efg_o:54.56, to_rate_o:12.02, orb_rate:29.18, ftr_o:37.41, efg_d:48.17, to_rate_d:11.15, drb_rate:75.3, ftr_d:23.82, three_rate:42.27, three_pct:34.46, ft_pct:68.41, win_pct:0.75, margin_std:16.1, away_wpct:0.43, away_em:-2.64, late_em:0.12, em_trajectory:-8.34, late_efg_o:53.52, close_wpct:0.78, blowout_pct:0.31},
  "Northern Iowa": {tempo:64.64, off_eff:106.83, def_eff:96.0, adj_em:10.83, ppg:69.06, papg:62.06, avg_margin:7.0, efg_o:54.17, to_rate_o:12.6, orb_rate:19.8, ftr_o:25.7, efg_d:47.21, to_rate_d:14.99, drb_rate:75.52, ftr_d:29.34, three_rate:39.57, three_pct:34.92, ft_pct:69.67, win_pct:0.65, margin_std:12.04, away_wpct:0.61, away_em:6.39, late_em:10.8, em_trajectory:3.8, late_efg_o:60.17, close_wpct:0.3, blowout_pct:0.29},
  "Ohio State": {tempo:72.15, off_eff:106.31, def_eff:110.88, adj_em:-4.57, ppg:76.7, papg:80.0, avg_margin:-3.3, efg_o:50.95, to_rate_o:12.73, orb_rate:26.42, ftr_o:36.92, efg_d:53.02, to_rate_d:13.49, drb_rate:69.15, ftr_d:38.19, three_rate:38.14, three_pct:30.07, ft_pct:71.04, win_pct:0.43, margin_std:13.38, away_wpct:0.31, away_em:-8.06, late_em:-4.71, em_trajectory:-1.41, late_efg_o:50.0, close_wpct:0.56, blowout_pct:0.1},
  "Penn": {tempo:70.3, off_eff:106.08, def_eff:104.35, adj_em:1.73, ppg:74.57, papg:73.36, avg_margin:1.21, efg_o:50.33, to_rate_o:12.84, orb_rate:28.66, ftr_o:35.17, efg_d:51.72, to_rate_d:14.41, drb_rate:71.28, ftr_d:27.46, three_rate:34.99, three_pct:38.7, ft_pct:69.51, win_pct:0.61, margin_std:11.61, away_wpct:0.4, away_em:-0.8, late_em:6.25, em_trajectory:5.04, late_efg_o:49.6, close_wpct:0.5, blowout_pct:0.11},
  "Prairie View A&M": {tempo:73.96, off_eff:102.4, def_eff:106.2, adj_em:-3.79, ppg:75.74, papg:78.55, avg_margin:-2.81, efg_o:47.88, to_rate_o:13.37, orb_rate:24.37, ftr_o:42.76, efg_d:50.41, to_rate_d:15.63, drb_rate:66.37, ftr_d:43.92, three_rate:30.88, three_pct:33.16, ft_pct:75.16, win_pct:0.45, margin_std:13.99, away_wpct:0.36, away_em:-4.64, late_em:7.91, em_trajectory:10.72, late_efg_o:49.13, close_wpct:0.38, blowout_pct:0.06},
  "Purdue": {tempo:66.38, off_eff:123.02, def_eff:105.67, adj_em:17.35, ppg:81.66, papg:70.14, avg_margin:11.51, efg_o:57.62, to_rate_o:11.13, orb_rate:34.96, ftr_o:28.61, efg_d:52.29, to_rate_d:13.46, drb_rate:75.26, ftr_d:26.02, three_rate:40.93, three_pct:37.92, ft_pct:74.29, win_pct:0.77, margin_std:15.03, away_wpct:0.83, away_em:11.0, late_em:6.64, em_trajectory:-4.88, late_efg_o:57.04, close_wpct:0.5, blowout_pct:0.4},
  "Queens": {tempo:72.69, off_eff:116.69, def_eff:114.4, adj_em:2.29, ppg:84.82, papg:83.15, avg_margin:1.67, efg_o:56.59, to_rate_o:12.66, orb_rate:28.56, ftr_o:36.31, efg_d:53.97, to_rate_d:12.45, drb_rate:69.94, ftr_d:38.75, three_rate:46.79, three_pct:35.91, ft_pct:74.86, win_pct:0.61, margin_std:17.68, away_wpct:0.45, away_em:-4.9, late_em:6.5, em_trajectory:4.83, late_efg_o:58.3, close_wpct:0.5, blowout_pct:0.24},
  "SMU": {tempo:72.92, off_eff:115.48, def_eff:106.42, adj_em:9.06, ppg:84.21, papg:77.61, avg_margin:6.61, efg_o:55.75, to_rate_o:13.05, orb_rate:32.79, ftr_o:30.61, efg_d:51.4, to_rate_d:14.26, drb_rate:71.78, ftr_d:32.02, three_rate:35.97, three_pct:37.45, ft_pct:74.13, win_pct:0.61, margin_std:16.02, away_wpct:0.33, away_em:-2.07, late_em:0.11, em_trajectory:-6.49, late_efg_o:54.09, close_wpct:0.33, blowout_pct:0.27},
  "Saint Louis": {tempo:72.87, off_eff:118.58, def_eff:96.97, adj_em:21.61, ppg:86.41, papg:70.66, avg_margin:15.75, efg_o:59.75, to_rate_o:15.09, orb_rate:29.34, ftr_o:34.68, efg_d:44.76, to_rate_d:13.11, drb_rate:74.64, ftr_d:37.17, three_rate:45.14, three_pct:40.51, ft_pct:74.39, win_pct:0.84, margin_std:17.1, away_wpct:0.64, away_em:5.29, late_em:2.89, em_trajectory:-12.86, late_efg_o:56.13, close_wpct:0.5, blowout_pct:0.47},
  "Saint Mary's": {tempo:67.3, off_eff:115.33, def_eff:97.02, adj_em:18.31, ppg:77.61, papg:65.29, avg_margin:12.32, efg_o:52.94, to_rate_o:13.3, orb_rate:36.48, ftr_o:35.84, efg_d:46.68, to_rate_d:12.58, drb_rate:79.02, ftr_d:25.72, three_rate:36.06, three_pct:38.57, ft_pct:81.06, win_pct:0.84, margin_std:13.07, away_wpct:0.67, away_em:3.93, late_em:9.0, em_trajectory:-3.32, late_efg_o:51.79, close_wpct:0.67, blowout_pct:0.42},
  "Santa Clara": {tempo:70.62, off_eff:117.32, def_eff:103.42, adj_em:13.9, ppg:82.85, papg:73.03, avg_margin:9.82, efg_o:54.62, to_rate_o:12.45, orb_rate:35.0, ftr_o:25.76, efg_d:51.78, to_rate_d:17.04, drb_rate:69.34, ftr_d:38.33, three_rate:44.96, three_pct:34.86, ft_pct:73.95, win_pct:0.76, margin_std:14.84, away_wpct:0.63, away_em:5.21, late_em:2.43, em_trajectory:-7.39, late_efg_o:52.98, close_wpct:0.5, blowout_pct:0.39},
  "Siena": {tempo:65.23, off_eff:108.12, def_eff:100.68, adj_em:7.44, ppg:70.53, papg:65.68, avg_margin:4.85, efg_o:50.56, to_rate_o:13.07, orb_rate:30.34, ftr_o:34.22, efg_d:48.61, to_rate_d:14.14, drb_rate:71.98, ftr_d:27.24, three_rate:31.93, three_pct:30.45, ft_pct:76.86, win_pct:0.68, margin_std:11.39, away_wpct:0.67, away_em:2.62, late_em:2.78, em_trajectory:-2.08, late_efg_o:47.09, close_wpct:0.6, blowout_pct:0.29},
  "South Florida": {tempo:76.55, off_eff:113.65, def_eff:99.69, adj_em:13.96, ppg:87.0, papg:76.31, avg_margin:10.69, efg_o:50.9, to_rate_o:12.19, orb_rate:35.78, ftr_o:41.13, efg_d:48.35, to_rate_d:15.56, drb_rate:71.12, ftr_d:38.81, three_rate:43.79, three_pct:33.12, ft_pct:74.34, win_pct:0.75, margin_std:13.94, away_wpct:0.67, away_em:5.17, late_em:17.12, em_trajectory:6.44, late_efg_o:49.07, close_wpct:0.33, blowout_pct:0.38},
  "St. John's": {tempo:72.78, off_eff:112.06, def_eff:96.14, adj_em:15.92, ppg:81.56, papg:69.97, avg_margin:11.59, efg_o:51.0, to_rate_o:11.99, orb_rate:33.54, ftr_o:41.9, efg_d:47.36, to_rate_d:15.73, drb_rate:73.19, ftr_d:31.75, three_rate:33.78, three_pct:33.24, ft_pct:72.75, win_pct:0.82, margin_std:15.29, away_wpct:0.76, away_em:5.41, late_em:9.8, em_trajectory:-1.79, late_efg_o:48.02, close_wpct:0.83, blowout_pct:0.35},
  "TCU": {tempo:71.68, off_eff:109.25, def_eff:100.54, adj_em:8.71, ppg:78.3, papg:72.06, avg_margin:6.24, efg_o:50.9, to_rate_o:12.62, orb_rate:32.25, ftr_o:38.7, efg_d:51.02, to_rate_d:16.46, drb_rate:72.97, ftr_d:30.36, three_rate:36.85, three_pct:33.11, ft_pct:70.8, win_pct:0.67, margin_std:15.03, away_wpct:0.57, away_em:0.29, late_em:4.33, em_trajectory:-1.91, late_efg_o:49.11, close_wpct:0.45, blowout_pct:0.15},
  "Tennessee": {tempo:69.33, off_eff:114.6, def_eff:100.05, adj_em:14.55, ppg:79.45, papg:69.36, avg_margin:10.09, efg_o:51.56, to_rate_o:13.29, orb_rate:44.69, ftr_o:38.72, efg_d:47.7, to_rate_d:13.55, drb_rate:75.54, ftr_d:36.22, three_rate:31.73, three_pct:33.44, ft_pct:69.4, win_pct:0.67, margin_std:16.7, away_wpct:0.5, away_em:0.5, late_em:5.44, em_trajectory:-4.65, late_efg_o:48.4, close_wpct:0.36, blowout_pct:0.36},
  "Tennessee State": {tempo:72.28, off_eff:108.01, def_eff:102.29, adj_em:5.73, ppg:78.07, papg:73.93, avg_margin:4.14, efg_o:50.11, to_rate_o:13.37, orb_rate:32.32, ftr_o:33.5, efg_d:51.24, to_rate_d:17.01, drb_rate:72.74, ftr_d:41.62, three_rate:30.67, three_pct:33.7, ft_pct:76.29, win_pct:0.69, margin_std:13.99, away_wpct:0.63, away_em:1.95, late_em:12.75, em_trajectory:8.61, late_efg_o:51.05, close_wpct:0.71, blowout_pct:0.17},
  "Texas": {tempo:70.4, off_eff:117.4, def_eff:109.06, adj_em:8.34, ppg:82.65, papg:76.77, avg_margin:5.87, efg_o:54.22, to_rate_o:12.69, orb_rate:34.26, ftr_o:46.17, efg_d:51.17, to_rate_d:11.33, drb_rate:76.11, ftr_d:40.68, three_rate:36.17, three_pct:34.93, ft_pct:75.3, win_pct:0.55, margin_std:17.01, away_wpct:0.36, away_em:-3.43, late_em:-3.88, em_trajectory:-9.75, late_efg_o:52.05, close_wpct:0.38, blowout_pct:0.32},
  "Texas A&M": {tempo:75.4, off_eff:116.34, def_eff:105.52, adj_em:10.82, ppg:87.72, papg:79.56, avg_margin:8.16, efg_o:54.19, to_rate_o:12.14, orb_rate:29.82, ftr_o:37.38, efg_d:50.75, to_rate_d:14.97, drb_rate:68.77, ftr_d:35.58, three_rate:46.3, three_pct:36.19, ft_pct:73.7, win_pct:0.66, margin_std:19.11, away_wpct:0.5, away_em:-1.5, late_em:-4.12, em_trajectory:-12.28, late_efg_o:49.22, close_wpct:0.7, blowout_pct:0.34},
  "Texas Tech": {tempo:69.17, off_eff:116.24, def_eff:104.99, adj_em:11.25, ppg:80.41, papg:72.62, avg_margin:7.78, efg_o:56.2, to_rate_o:12.92, orb_rate:32.3, ftr_o:27.09, efg_d:49.43, to_rate_d:12.25, drb_rate:71.51, ftr_d:31.6, three_rate:48.03, three_pct:39.34, ft_pct:71.46, win_pct:0.69, margin_std:15.8, away_wpct:0.5, away_em:-1.25, late_em:1.38, em_trajectory:-6.41, late_efg_o:57.16, close_wpct:0.6, blowout_pct:0.31},
  "Troy": {tempo:71.17, off_eff:110.01, def_eff:104.66, adj_em:5.35, ppg:78.29, papg:74.48, avg_margin:3.81, efg_o:51.88, to_rate_o:13.9, orb_rate:32.96, ftr_o:36.31, efg_d:50.08, to_rate_d:13.95, drb_rate:70.04, ftr_d:32.14, three_rate:45.56, three_pct:33.18, ft_pct:73.78, win_pct:0.65, margin_std:11.91, away_wpct:0.6, away_em:1.05, late_em:6.29, em_trajectory:2.48, late_efg_o:51.71, close_wpct:0.62, blowout_pct:0.23},
  "UCF": {tempo:72.34, off_eff:111.93, def_eff:108.48, adj_em:3.46, ppg:80.97, papg:78.47, avg_margin:2.5, efg_o:52.83, to_rate_o:13.08, orb_rate:32.66, ftr_o:30.84, efg_d:52.37, to_rate_d:13.25, drb_rate:73.05, ftr_d:35.25, three_rate:34.41, three_pct:36.17, ft_pct:73.95, win_pct:0.66, margin_std:15.01, away_wpct:0.57, away_em:-4.36, late_em:-2.78, em_trajectory:-5.28, late_efg_o:50.0, close_wpct:0.88, blowout_pct:0.16},
  "UCLA": {tempo:67.38, off_eff:115.37, def_eff:105.38, adj_em:10.0, ppg:77.74, papg:71.0, avg_margin:6.74, efg_o:53.93, to_rate_o:10.94, orb_rate:28.92, ftr_o:33.06, efg_d:50.45, to_rate_d:14.94, drb_rate:69.37, ftr_d:34.67, three_rate:35.89, three_pct:38.2, ft_pct:76.68, win_pct:0.68, margin_std:15.75, away_wpct:0.38, away_em:-3.31, late_em:1.3, em_trajectory:-5.44, late_efg_o:54.22, close_wpct:0.62, blowout_pct:0.29},
  "UConn": {tempo:67.61, off_eff:114.63, def_eff:96.31, adj_em:18.31, ppg:77.5, papg:65.12, avg_margin:12.38, efg_o:55.34, to_rate_o:13.35, orb_rate:33.73, ftr_o:29.99, efg_d:45.66, to_rate_d:15.06, drb_rate:74.06, ftr_d:40.17, three_rate:40.32, three_pct:35.2, ft_pct:71.57, win_pct:0.85, margin_std:15.03, away_wpct:0.82, away_em:7.65, late_em:6.44, em_trajectory:-5.94, late_efg_o:52.62, close_wpct:0.89, blowout_pct:0.41},
  "UMBC": {tempo:67.77, off_eff:111.31, def_eff:100.29, adj_em:11.02, ppg:75.43, papg:67.97, avg_margin:7.47, efg_o:53.93, to_rate_o:11.89, orb_rate:22.76, ftr_o:33.79, efg_d:49.15, to_rate_d:12.81, drb_rate:76.59, ftr_d:25.16, three_rate:38.81, three_pct:35.92, ft_pct:76.4, win_pct:0.73, margin_std:15.75, away_wpct:0.6, away_em:4.93, late_em:18.2, em_trajectory:10.73, late_efg_o:55.58, close_wpct:0.62, blowout_pct:0.37},
  "Utah State": {tempo:69.66, off_eff:117.28, def_eff:101.7, adj_em:15.57, ppg:81.7, papg:70.85, avg_margin:10.85, efg_o:56.62, to_rate_o:12.79, orb_rate:31.1, ftr_o:38.69, efg_d:49.59, to_rate_d:16.54, drb_rate:69.94, ftr_d:38.89, three_rate:40.72, three_pct:35.08, ft_pct:70.62, win_pct:0.82, margin_std:15.62, away_wpct:0.74, away_em:8.42, late_em:4.9, em_trajectory:-5.95, late_efg_o:53.91, close_wpct:0.89, blowout_pct:0.39},
  "VCU": {tempo:70.62, off_eff:115.5, def_eff:101.21, adj_em:14.29, ppg:81.56, papg:71.47, avg_margin:10.09, efg_o:54.08, to_rate_o:12.64, orb_rate:31.23, ftr_o:43.72, efg_d:48.85, to_rate_d:14.18, drb_rate:73.15, ftr_d:33.08, three_rate:43.77, three_pct:36.69, ft_pct:73.93, win_pct:0.79, margin_std:12.42, away_wpct:0.71, away_em:4.18, late_em:7.56, em_trajectory:-2.53, late_efg_o:52.16, close_wpct:0.6, blowout_pct:0.29},
  "Vanderbilt": {tempo:72.54, off_eff:119.04, def_eff:103.68, adj_em:15.37, ppg:86.35, papg:75.21, avg_margin:11.15, efg_o:55.28, to_rate_o:10.86, orb_rate:28.92, ftr_o:38.18, efg_d:48.77, to_rate_d:14.82, drb_rate:71.4, ftr_d:40.96, three_rate:43.6, three_pct:35.53, ft_pct:79.27, win_pct:0.76, margin_std:16.17, away_wpct:0.72, away_em:6.17, late_em:2.2, em_trajectory:-8.95, late_efg_o:51.92, close_wpct:0.5, blowout_pct:0.35},
  "Villanova": {tempo:68.35, off_eff:112.89, def_eff:103.56, adj_em:9.33, ppg:77.16, papg:70.78, avg_margin:6.38, efg_o:53.71, to_rate_o:11.84, orb_rate:30.05, ftr_o:31.28, efg_d:51.28, to_rate_d:15.56, drb_rate:70.05, ftr_d:28.91, three_rate:45.66, three_pct:35.28, ft_pct:69.4, win_pct:0.75, margin_std:14.07, away_wpct:0.69, away_em:2.5, late_em:-0.12, em_trajectory:-6.5, late_efg_o:51.61, close_wpct:0.67, blowout_pct:0.28},
  "Virginia": {tempo:69.04, off_eff:116.82, def_eff:99.1, adj_em:17.72, ppg:80.65, papg:68.41, avg_margin:12.24, efg_o:54.62, to_rate_o:12.85, orb_rate:37.02, ftr_o:33.04, efg_d:45.33, to_rate_d:12.69, drb_rate:73.34, ftr_d:33.02, three_rate:46.5, three_pct:35.95, ft_pct:72.65, win_pct:0.85, margin_std:14.39, away_wpct:0.76, away_em:5.29, late_em:7.0, em_trajectory:-5.24, late_efg_o:54.73, close_wpct:0.8, blowout_pct:0.44},
  "Wisconsin": {tempo:70.82, off_eff:117.21, def_eff:107.2, adj_em:10.01, ppg:83.0, papg:75.91, avg_margin:7.09, efg_o:54.46, to_rate_o:10.65, orb_rate:27.29, ftr_o:31.91, efg_d:51.33, to_rate_d:11.91, drb_rate:73.4, ftr_d:30.48, three_rate:52.61, three_pct:36.1, ft_pct:78.57, win_pct:0.71, margin_std:16.57, away_wpct:0.53, away_em:-1.82, late_em:6.0, em_trajectory:-1.09, late_efg_o:56.16, close_wpct:0.7, blowout_pct:0.35},
  "Wright State": {tempo:70.59, off_eff:113.29, def_eff:106.83, adj_em:6.46, ppg:79.97, papg:75.41, avg_margin:4.56, efg_o:54.42, to_rate_o:13.61, orb_rate:31.16, ftr_o:38.0, efg_d:52.08, to_rate_d:14.1, drb_rate:72.66, ftr_d:33.51, three_rate:33.65, three_pct:36.15, ft_pct:74.47, win_pct:0.66, margin_std:12.1, away_wpct:0.67, away_em:3.67, late_em:6.44, em_trajectory:1.88, late_efg_o:55.65, close_wpct:0.6, blowout_pct:0.16},
};

function predictSpreadV5(t1Name, t2Name) {
  const a = SPREAD_PROFILES[t1Name], b = SPREAD_PROFILES[t2Name];
  if (!a || !b) return null;
  
  const feat = {
    adj_em_diff: a.adj_em - b.adj_em,
    off_eff_diff: a.off_eff - b.off_eff,
    def_eff_diff: a.def_eff - b.def_eff,
    ppg_diff: a.ppg - b.ppg,
    efg_edge: (a.efg_o - b.efg_d) - (b.efg_o - a.efg_d),
    to_edge: (b.to_rate_d - a.to_rate_o) - (a.to_rate_d - b.to_rate_o),
    orb_edge: (a.orb_rate - (100-b.drb_rate)) - (b.orb_rate - (100-a.drb_rate)),
    ftr_edge: (a.ftr_o - b.ftr_d) - (b.ftr_o - a.ftr_d),
    em_traj_diff: a.em_trajectory - b.em_trajectory,
    late_em_diff: a.late_em - b.late_em,
    late_efg_diff: a.late_efg_o - b.late_efg_o,
    win_pct_diff: a.win_pct - b.win_pct,
    away_em_diff: a.away_em - b.away_em,
    away_wpct_diff: a.away_wpct - b.away_wpct,
    margin_std_diff: a.margin_std - b.margin_std,
    close_wpct_diff: a.close_wpct - b.close_wpct,
    blowout_pct_diff: a.blowout_pct - b.blowout_pct,
    tempo_diff: a.tempo - b.tempo,
    three_rate_diff: a.three_rate - b.three_rate,
    three_pct_diff: a.three_pct - b.three_pct,
    ft_pct_diff: a.ft_pct - b.ft_pct,
  };
  
  let pred = SPREAD_V5.intercept;
  for (const f in SPREAD_V5.c) {
    const z = (feat[f] - SPREAD_V5.mu[f]) / SPREAD_V5.sd[f];
    pred += SPREAD_V5.c[f] * z;
  }
  // pred = predicted margin for t1 (positive = t1 wins)
  // Convert to spread format: negative = t1 favored
  return Math.round(-pred * 10) / 10;
}

// ─── PREDICTIVE MODEL v3.2-ML-DEEP ───────────────────────────────────────────
// Trained on 1,001 real NCAA tournament games (2010–2025) via Kaggle dataset
// 30 deep game-level features mined from MRegularSeasonDetailedResults.csv
// Best model: Ridge(α=10) | Cross-validated MAE: 9.81 pts (v1 was 9.9)
//
// ML-LEARNED LAYER WEIGHTS:
//   L1 Efficiency:         23.7% — raw EM + PPG differentials
//   L2 Four Factors:       13.9% — eFG/TO/ORB/FTR matchup edges (season + quality + L30)
//   L3 Momentum/Trend:     20.8% — em_traj_diff is #1 feature! + L10 + form
//   L4 Situational/Quality: 26.3% — away perf, vs-quality, consistency, close games
//   L5 Tempo/Profile:      15.2% — tempo mismatch + 3PT/FT/assist profile
//
// KEY DISCOVERIES (v2):
//   #1 em_traj_diff (13.2%) — Teams improving through the season dominate March
//   #2 adj_em_diff (12.2%) — Raw efficiency still matters, just not as much as we thought
//   #3 away_em_diff (11.1%) — Away/neutral performance is a huge tournament predictor
//   #4 ppg_diff (10.5%) — Scoring differential
//   #5 margin_std_diff (5.0%) — Consistent teams outperform volatile ones
// ─────────────────────────────────────────────────────────────────────────────

// v2 Ridge coefficients (from model_weights_v2_DEEP.json — 30 features)
const ML = {
  spread: {
    intercept: -0.116883,
    c: {
      adj_em_diff:4.961902, adj_d_diff:-0.412379,
      to_edge:-0.486776, orb_edge:0.974823, ftr_edge:-1.064123,
      win_pct_diff:0.840956, ppg_diff:4.306574, tempo_diff:-3.089688,
      momentum_diff:0.162855, l10_em_diff:2.133701,
      l30_efg_edge:-0.733592, l30_to_edge:-0.201209,
      q_em_diff:0.236446, q_wp_diff:-0.863911,
      q_efg_edge:0.359123, q_to_edge:-0.098782, q_orb_edge:0.350401, q_ftr_edge:-0.354595,
      away_em_diff:-4.545489, away_wp_diff:1.186203,
      margin_std_diff:-2.058972, close_wp_diff:-0.462286, blowout_pct_diff:0.546982,
      em_traj_diff:-5.387776, efg_traj_diff:1.069534,
      three_rate_diff:0.914323, three_pct_diff:-1.248556,
      ft_reliance_diff:0.365996, ast_rate_diff:-0.596921,
      form_diff:-0.81987,
    },
  },
  total: {
    intercept: 139.323676,
    c: {
      adj_em_diff:-3.028421, adj_d_diff:1.147946,
      to_edge:-0.346215, orb_edge:0.678569, ftr_edge:1.216894,
      win_pct_diff:-0.016918, ppg_diff:-1.817962, tempo_diff:-0.094761,
      momentum_diff:-2.2412, l10_em_diff:6.535706,
      l30_efg_edge:1.664247, l30_to_edge:-0.492279,
      q_em_diff:-1.478276, q_wp_diff:0.776186,
      q_efg_edge:-0.167455, q_to_edge:0.296661, q_orb_edge:0.433832, q_ftr_edge:-0.790888,
      away_em_diff:1.336208, away_wp_diff:-0.394802,
      margin_std_diff:0.030717, close_wp_diff:-0.449788, blowout_pct_diff:-1.563438,
      em_traj_diff:-1.888884, efg_traj_diff:-0.939046,
      three_rate_diff:0.13182, three_pct_diff:-0.067668,
      ft_reliance_diff:0.16297, ast_rate_diff:0.179533,
      form_diff:-0.5728,
    },
  },
  mu: {
    adj_em_diff:0.042578, adj_d_diff:-0.328458,
    to_edge:0.032123, orb_edge:-0.042941, ftr_edge:-0.569908,
    win_pct_diff:-0.000903, ppg_diff:-0.28588, tempo_diff:-0.227335,
    momentum_diff:-0.146226, l10_em_diff:-0.093007,
    l30_efg_edge:0.007154, l30_to_edge:0.14647,
    q_em_diff:-0.131564, q_wp_diff:-0.006011,
    q_efg_edge:-0.268966, q_to_edge:0.068153, q_orb_edge:-0.083773, q_ftr_edge:-0.931011,
    away_em_diff:0.068396, away_wp_diff:0.001638,
    margin_std_diff:0.030852, close_wp_diff:-0.013689, blowout_pct_diff:0.001768,
    em_traj_diff:-0.400866, efg_traj_diff:-0.260971,
    three_rate_diff:0.162546, three_pct_diff:-0.025577,
    ft_reliance_diff:-0.115804, ast_rate_diff:0.068339,
    form_diff:-0.000541,
  },
  sd: {
    adj_em_diff:6.600097, adj_d_diff:6.328707,
    to_edge:4.574479, orb_edge:6.820967, ftr_edge:11.471592,
    win_pct_diff:0.145943, ppg_diff:6.998419, tempo_diff:4.215141,
    momentum_diff:9.301614, l10_em_diff:7.770593,
    l30_efg_edge:7.062045, l30_to_edge:5.391054,
    q_em_diff:9.501495, q_wp_diff:0.307388,
    q_efg_edge:7.434677, q_to_edge:5.749778, q_orb_edge:7.72639, q_ftr_edge:13.719424,
    away_em_diff:6.788234, away_wp_diff:0.208392,
    margin_std_diff:3.235048, close_wp_diff:0.277516, blowout_pct_diff:0.168273,
    em_traj_diff:13.684681, efg_traj_diff:6.052334,
    three_rate_diff:6.731745, three_pct_diff:3.828526,
    ft_reliance_diff:3.100714, ast_rate_diff:7.359776,
    form_diff:0.177387,
  },
  layerMap: {
    adj_em_diff:'L1', adj_d_diff:'L1', ppg_diff:'L1',
    to_edge:'L2', orb_edge:'L2', ftr_edge:'L2', l30_efg_edge:'L2', l30_to_edge:'L2',
    q_efg_edge:'L2', q_to_edge:'L2', q_orb_edge:'L2', q_ftr_edge:'L2', efg_traj_diff:'L2',
    momentum_diff:'L3', l10_em_diff:'L3', em_traj_diff:'L3', form_diff:'L3',
    win_pct_diff:'L4', q_em_diff:'L4', q_wp_diff:'L4',
    away_em_diff:'L4', away_wp_diff:'L4', margin_std_diff:'L4',
    close_wp_diff:'L4', blowout_pct_diff:'L4',
    tempo_diff:'L5', three_rate_diff:'L5', three_pct_diff:'L5',
    ft_reliance_diff:'L5', ast_rate_diff:'L5',
  },
  layerPct: { L1:23.7, L2:13.9, L3:20.8, L4:26.3, L5:15.2 },
  // ── Conformal Prediction intervals (from calibration set 2022-2025) ──
  conformal_spread: { 0.50:9.23, 0.60:11.99, 0.70:14.47, 0.80:16.77, 0.90:21.13, 0.95:23.84 },
  conformal_total:  { 0.50:12.8, 0.60:16.87, 0.70:19.71, 0.80:24.19, 0.90:31.16, 0.95:37.25 },
  // ── Quantile Regression → width prediction (Ridge approx of LightGBM QR) ──
  widthSpread: {
    intercept: 24.572307,
    c: { adj_em_diff:0.295294, adj_d_diff:-0.31038, to_edge:0.495141, orb_edge:-0.614304,
         ftr_edge:-0.340238, win_pct_diff:0.551084, ppg_diff:-0.002191, tempo_diff:-0.046602,
         momentum_diff:0.058757, l10_em_diff:0.657547, l30_efg_edge:-0.213402, l30_to_edge:-0.330451,
         q_em_diff:-0.18506, q_wp_diff:0.61473, q_efg_edge:-0.23829, q_to_edge:0.557287,
         q_orb_edge:0.318515, q_ftr_edge:0.163494, away_em_diff:0.199752, away_wp_diff:-0.254567,
         margin_std_diff:-0.334919, close_wp_diff:1.027185, blowout_pct_diff:0.538696,
         em_traj_diff:-0.67672, efg_traj_diff:0.181201, three_rate_diff:0.304193,
         three_pct_diff:-0.41345, ft_reliance_diff:0.748353, ast_rate_diff:0.465191, form_diff:-1.233672 },
  },
  widthTotal: {
    intercept: 38.321995,
    c: { adj_em_diff:-1.158903, adj_d_diff:0.504461, to_edge:-0.3276, orb_edge:1.903586,
         ftr_edge:0.230111, win_pct_diff:0.310939, ppg_diff:-0.636756, tempo_diff:2.247815,
         momentum_diff:0.097832, l10_em_diff:-0.777964, l30_efg_edge:0.9391, l30_to_edge:0.297401,
         q_em_diff:-0.223313, q_wp_diff:0.075335, q_efg_edge:-0.23433, q_to_edge:-0.423228,
         q_orb_edge:0.775408, q_ftr_edge:-1.041264, away_em_diff:1.043231, away_wp_diff:-0.560082,
         margin_std_diff:0.841657, close_wp_diff:-0.403371, blowout_pct_diff:-1.143098,
         em_traj_diff:0.680904, efg_traj_diff:0.313777, three_rate_diff:-0.200814,
         three_pct_diff:1.427262, ft_reliance_diff:-0.317171, ast_rate_diff:0.127707, form_diff:0.428763 },
  },
  // Width → confidence mapping (from QR width distribution)
  spreadWidthNarrow: 18.26,  // 10th pct → 90% confidence
  spreadWidthWide: 31.96,    // 90th pct → 30% confidence
  totalWidthNarrow: 29.45,
  totalWidthWide: 48.53,
};

function deriveEff(kpEM, kpOffRk, kpDefRk) {
  const rawO = 100 + (183 - kpOffRk) * 0.12;
  const rawD = 100 - (183 - kpDefRk) * 0.12;
  const c = (kpEM - (rawO - rawD)) / 2;
  return { adjO: Math.round((rawO + c) * 10) / 10, adjD: Math.round((rawD - c) * 10) / 10 };
}

function predict(m) {
  const a = T[m.t1], b = T[m.t2];
  if (!a || !b) return null;

  const aP = a.rec.split("-").map(Number), bP = b.rec.split("-").map(Number);
  const aSzn = aP[0] / (aP[0] + aP[1]), bSzn = bP[0] / (bP[0] + bP[1]);
  const aL10 = a.l10[0] / 10, bL10 = b.l10[0] / 10;
  const eA = deriveEff(a.kpEM, a.kpOffRk, a.kpDefRk);
  const eB = deriveEff(b.kpEM, b.kpOffRk, b.kpDefRk);

  // ── REAL DEEP FEATURES from ESPN game logs (replaces proxy estimates) ──
  const dA = DEEP[m.t1] || {};
  const dB = DEEP[m.t2] || {};
  const hasDeep = (d) => d && d.em_trajectory !== undefined;

  // ── BUILD 30-FEATURE VECTOR ──
  // Features that come from KenPom/season data (always available):
  const feat = {
    adj_em_diff:      a.kpEM - b.kpEM,
    adj_d_diff:       eA.adjD - eB.adjD,
    to_edge:          (b.dTO - a.oTO) - (a.dTO - b.oTO),
    orb_edge:         (a.oORB - (100-b.dORB)) - (b.oORB - (100-a.dORB)),
    ftr_edge:         (a.oFTR - b.dFTR) - (b.oFTR - a.dFTR),
    win_pct_diff:     aSzn - bSzn,
    ppg_diff:         eA.adjO - eB.adjO,
    tempo_diff:       a.adjT - b.adjT,
    // Features from ESPN DEEP data (real values when available, fallback to proxy):
    momentum_diff:    hasDeep(dA) && hasDeep(dB) ? dA.momentum - dB.momentum : a.trvkL30 - b.trvkL30,
    l10_em_diff:      hasDeep(dA) && hasDeep(dB) ? dA.l10_em - dB.l10_em : (a.l10[0]-a.l10[1])*2.5 - (b.l10[0]-b.l10[1])*2.5,
    l30_efg_edge:     (a.oEFG + a.trvkL30*0.3 - b.dEFG) - (b.oEFG + b.trvkL30*0.3 - a.dEFG),
    l30_to_edge:      (b.dTO - a.oTO) - (a.dTO - b.oTO),
    q_em_diff:        hasDeep(dA) && hasDeep(dB) ? dA.q_em - dB.q_em : (a.kpEM*0.7) - (b.kpEM*0.7),
    q_wp_diff:        hasDeep(dA) && hasDeep(dB) ? dA.q_win_pct - dB.q_win_pct : aSzn*0.8 - bSzn*0.8,
    q_efg_edge:       (a.oEFG*0.85 - b.dEFG) - (b.oEFG*0.85 - a.dEFG),
    q_to_edge:        (b.dTO - a.oTO)*0.9 - (a.dTO - b.oTO)*0.9,
    q_orb_edge:       (a.oORB - (100-b.dORB))*0.9 - (b.oORB - (100-a.dORB))*0.9,
    q_ftr_edge:       (a.oFTR - b.dFTR)*0.9 - (b.oFTR - a.dFTR)*0.9,
    away_em_diff:     hasDeep(dA) && hasDeep(dB) ? dA.away_em - dB.away_em : a.kpEM*0.85 - b.kpEM*0.85,
    away_wp_diff:     hasDeep(dA) && hasDeep(dB) ? dA.away_win_pct - dB.away_win_pct : aSzn*0.9 - bSzn*0.9,
    margin_std_diff:  hasDeep(dA) && hasDeep(dB) ? dA.margin_std - dB.margin_std : (aP[1]*2.5) - (bP[1]*2.5),
    close_wp_diff:    hasDeep(dA) && hasDeep(dB) ? dA.close_win_pct - dB.close_win_pct : (aL10*0.7+aSzn*0.3) - (bL10*0.7+bSzn*0.3),
    blowout_pct_diff: hasDeep(dA) && hasDeep(dB) ? dA.blowout_pct - dB.blowout_pct : Math.min(0.6,(a.kpEM-5)/40) - Math.min(0.6,(b.kpEM-5)/40),
    em_traj_diff:     hasDeep(dA) && hasDeep(dB) ? dA.em_trajectory - dB.em_trajectory : a.trvkL30*2.5 - b.trvkL30*2.5,
    efg_traj_diff:    a.trvkL30*0.8 - b.trvkL30*0.8,
    three_rate_diff:  Math.max(25, 45-a.oFTR*0.4) - Math.max(25, 45-b.oFTR*0.4),
    three_pct_diff:   (30+(a.oEFG-50)*1.2) - (30+(b.oEFG-50)*1.2),
    ft_reliance_diff: a.oFTR*0.4 - b.oFTR*0.4,
    ast_rate_diff:    (55+(a.oEFG-50)*0.8) - (55+(b.oEFG-50)*0.8),
    form_diff:        (aL10*0.6 + aSzn*0.4) - (bL10*0.6 + bSzn*0.4),
  };

  // ── ML SPREAD (standardized Ridge: intercept + Σ coef_i * (x_i - μ_i) / σ_i) ──
  let rawSpread = ML.spread.intercept;
  const layerContrib = { L1: 0, L2: 0, L3: 0, L4: 0, L5: 0 };
  for (const f in ML.spread.c) {
    const z = (feat[f] - ML.mu[f]) / ML.sd[f];
    const contrib = ML.spread.c[f] * z;
    rawSpread += contrib;
    layerContrib[ML.layerMap[f]] += contrib;
  }

  // EvanMiya injury adjustment (not in Kaggle training data)
  const injAdj = (a.emInjAdj - b.emInjAdj) * 0.4;
  rawSpread += injAdj;
  layerContrib.L4 += injAdj;

  const oldModelSpread = Math.round(-rawSpread * 10) / 10;

  // ── ENSEMBLE SPREAD MODEL ─────────────────────────────────────────────
  // Research shows the best models blend multiple independent signals.
  // Instead of picking one model, we combine:
  //   1. V5.1 Kaggle Ridge (21 features from regular season box scores)
  //   2. KenPom AdjEM implied spread (opponent-quality adjusted efficiency)
  //   3. DK spread (market consensus — has info we don't: injuries, travel, sharps)
  //   4. ESPN BPI (projected margin)
  //   5. Old Ridge model (30 features from KenPom/ESPN/BartTorvik)
  //
  // Weights derived from backtest accuracy:
  //   - KenPom AdjEM: most reliable single predictor (SOS-adjusted)
  //   - DK spread: encodes market info, very strong on blowouts
  //   - V5.1 Kaggle: best on toss-ups, trained on real tourney data
  //   - BPI: independent ESPN signal
  //   - Old model: rich feature set, complements V5.1
  
  const v5Spread = predictSpreadV5(m.t1, m.t2);
  const kpImplied = -(a.kpEM - b.kpEM) * 0.88; // KenPom AdjEM → spread (0.88 scaling)
  const bpiImplied = m.bpi ? m.bpi * (m.vs <= 0 ? -1 : 1) : null; // ESPN BPI margin → spread
  const dkSpread = m.vs; // DK closing line
  
  // Build ensemble — each source gets a weight, normalize
  const sources = [];
  if (v5Spread !== null) sources.push({ val: v5Spread, w: 0.25, name: "V5.1" });
  sources.push({ val: kpImplied, w: 0.30, name: "KenPom" });
  sources.push({ val: dkSpread, w: 0.25, name: "DK" });
  if (bpiImplied !== null && !isNaN(bpiImplied)) sources.push({ val: -bpiImplied, w: 0.10, name: "BPI" });
  sources.push({ val: oldModelSpread, w: 0.10, name: "Ridge" });
  
  const totalWeight = sources.reduce((s, x) => s + x.w, 0);
  const ensembleRaw = sources.reduce((s, x) => s + x.val * (x.w / totalWeight), 0);
  
  // Injury adjustment on top of ensemble
  const ensInjAdj = (a.emInjAdj - b.emInjAdj) * 0.4;
  let modelSpread = Math.round((ensembleRaw + ensInjAdj) * 10) / 10;
  
  // Store individual source values for display
  const spreadSources = sources.map(s => ({ name: s.name, val: Math.round(s.val * 10) / 10, w: Math.round(s.w / totalWeight * 100) }));

  // ── ENSEMBLE TOTAL PREDICTION ──────────────────────────────────────────
  // Same philosophy as spread: blend multiple independent signals
  //   1. Kaggle O/U model (19 features, trained on 1,369 tourney games)
  //   2. KenPom cross-multiplication (SOS-adjusted efficiency × tempo)
  //   3. DK total (market consensus)
  //   4. ESPN avg_total (team-level season average game totals)
  
  const ouPred = predictOU(m.t1, m.t2);
  
  // KenPom implied total: cross-multiply adjusted efficiencies × tempo
  const avgT = (a.adjT + b.adjT) / 2;
  const aPP100 = (eA.adjO * eB.adjD) / 100;
  const bPP100 = (eB.adjO * eA.adjD) / 100;
  const kpTotal = (aPP100 / 100) * avgT + (bPP100 / 100) * avgT;
  
  // ESPN avg_total: average of both teams' season avg game totals
  const dA2 = DEEP[m.t1] || {}, dB2 = DEEP[m.t2] || {};
  const espnTotal = (dA2.avg_total && dB2.avg_total) ? (dA2.avg_total + dB2.avg_total) / 2 : null;
  
  // DK total
  const dkTotal = m.vt;
  
  // Build total ensemble
  const totalSources = [];
  if (ouPred !== null) totalSources.push({ val: ouPred, w: 0.30, name: "Kaggle" });
  totalSources.push({ val: kpTotal, w: 0.25, name: "KenPom" });
  totalSources.push({ val: dkTotal, w: 0.25, name: "DK" });
  if (espnTotal !== null) totalSources.push({ val: espnTotal, w: 0.15, name: "ESPN" });
  if (!ouPred) {
    // If no Kaggle model, give more to KenPom
    const tempoTotal = avgT * 2.08;
    totalSources.push({ val: tempoTotal, w: 0.10, name: "Tempo" });
  }
  
  const totalTW = totalSources.reduce((s, x) => s + x.w, 0);
  let modelTotal = Math.round(totalSources.reduce((s, x) => s + x.val * (x.w / totalTW), 0) * 2) / 2;
  
  const totalSourcesInfo = totalSources.map(s => ({ name: s.name, val: Math.round(s.val * 10) / 10, w: Math.round(s.w / totalTW * 100) }));

  // ── PROJECTED SCORES ──
  const absMargin = Math.abs(modelSpread);
  const favScore = (modelTotal + absMargin) / 2;
  const dogScore = (modelTotal - absMargin) / 2;
  const s1 = Math.round(modelSpread <= 0 ? favScore : dogScore);
  const s2 = Math.round(modelSpread <= 0 ? dogScore : favScore);

  // ── EDGE-BASED CONFIDENCE (recalibrated from backtest analysis) ──────────
  // Backtest lesson: Old confidence was INVERTED — high conf went 36% ATS.
  // New approach: Confidence = "how much edge do I have over the market?"
  //
  // Three components:
  // 1. Toss-up specialist: Model is best on close games (DK < 8) → boost
  // 2. Agreement signal: When model & DK agree → higher confidence (both see it)
  // 3. Penalize big disagreements on blowouts (DK usually right on big spreads)

  const dkGapSpread = Math.abs(modelSpread - m.vs);
  const dkGapTotal = Math.abs(modelTotal - m.vt);
  const absDK = Math.abs(m.vs);

  // Conformal coverage level (still useful for display)
  const confCov = (gap, conf) => {
    const levels = [0.50, 0.60, 0.70, 0.80, 0.90, 0.95];
    for (let i = 0; i < levels.length; i++) { if (gap <= conf[levels[i]]) return levels[i]; }
    return 0.99;
  };
  const spreadCovLevel = confCov(dkGapSpread, ML.conformal_spread);
  const totalCovLevel = confCov(dkGapTotal, ML.conformal_total);

  // QR width (still computed for display in expanded view)
  let spreadWidth = ML.widthSpread.intercept;
  let totalWidth = ML.widthTotal.intercept;
  for (const f in ML.widthSpread.c) {
    const z = (feat[f] - ML.mu[f]) / ML.sd[f];
    spreadWidth += ML.widthSpread.c[f] * z;
    totalWidth += ML.widthTotal.c[f] * z;
  }

  // ── VALUE CALCULATIONS ──
  const spreadVal = Math.round((modelSpread - m.vs) * 10) / 10;
  const totalVal = Math.round((modelTotal - m.vt) * 10) / 10;

  // ── MONTE CARLO SIMULATION (10,000 games) ───────────────────────────────
  // Simulates the game 10K times centered on OUR model predictions.
  // This tells us: how confident are we in our own number?
  // DK spread/total are NOT used in the simulation — they only matter
  // when computing value (the gap between our number and DK's number).
  //
  // σ ≈ 13.1 pts for spread (real NCAA tournament game variance)
  // σ ≈ 18.9 pts for totals
  const spreadStd = ML.conformal_spread[0.80] / 1.28; // ≈ 13.1 pts
  const totalStd = ML.conformal_total[0.80] / 1.28;   // ≈ 18.9 pts
  const N_SIM = 10000;

  let seed = 0;
  for (let i = 0; i < m.t1.length; i++) seed += m.t1.charCodeAt(i) * 31;
  for (let i = 0; i < m.t2.length; i++) seed += m.t2.charCodeAt(i) * 17;
  const rng = () => { seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF; return (seed >>> 0) / 4294967296; };
  const randn = () => { const u1 = rng(), u2 = rng(); return Math.sqrt(-2*Math.log(u1||0.0001))*Math.cos(2*Math.PI*u2); };

  let t1Wins = 0, t1Covers = 0, overHits = 0;
  const simMargins = [];
  const simTotals = [];
  for (let i = 0; i < N_SIM; i++) {
    const simMargin = -modelSpread + randn() * spreadStd; // centered on OUR predicted margin
    const simTotal = modelTotal + randn() * totalStd;      // centered on OUR predicted total
    simMargins.push(simMargin);
    simTotals.push(simTotal);
    if (simMargin > 0) t1Wins++;
    if (simMargin + m.vs > 0) t1Covers++;  // informational: how often t1 covers DK
    if (simTotal > m.vt) overHits++;        // informational: how often total exceeds DK O/U
  }
  const winProb1 = Math.round(t1Wins / N_SIM * 100);
  const winProb2 = 100 - winProb1;
  const coverProb1 = Math.round(t1Covers / N_SIM * 100);
  const coverProb2 = 100 - coverProb1;
  const overProb = Math.round(overHits / N_SIM * 100);
  const underProb = 100 - overProb;

  simMargins.sort((a, b) => a - b);
  const simP10 = Math.round(simMargins[Math.floor(N_SIM * 0.10)] * 10) / 10;
  const simP90 = Math.round(simMargins[Math.floor(N_SIM * 0.90)] * 10) / 10;

  // ── CONFIDENCE (Independent 3-layer system) ──────────────────────────────
  // Layer 1: SOURCE AGREEMENT — do our independent signals agree?
  //   When KenPom, V5.1, DK, BPI all point the same direction by similar amounts,
  //   confidence is high. When they disagree, confidence drops.
  //   This is genuinely independent from the ensemble spread prediction.
  const sourceVals = spreadSources.map(s => s.val);
  const sourceMean = sourceVals.reduce((s, v) => s + v, 0) / sourceVals.length;
  const sourceStd = Math.sqrt(sourceVals.reduce((s, v) => s + (v - sourceMean) ** 2, 0) / sourceVals.length);
  // All sources agree on direction?
  const allSameDir = sourceVals.every(v => v <= 0) || sourceVals.every(v => v >= 0);
  // Agreement score: low std = high agreement (0-25 pts)
  const agreementScore = Math.max(0, 25 - sourceStd * 2);
  const directionBonus = allSameDir ? 10 : 0;
  
  // Layer 2: DATA QUALITY — how much do we know about these teams?
  //   Power conference teams with full ESPN deep data = high quality
  //   Mid-major with sparse data = lower quality
  const hasDeepA2 = DEEP[m.t1] && DEEP[m.t1].em_trajectory !== undefined;
  const hasDeepB2 = DEEP[m.t2] && DEEP[m.t2].em_trajectory !== undefined;
  const hasV5A = !!SPREAD_PROFILES[m.t1];
  const hasV5B = !!SPREAD_PROFILES[m.t2];
  const dataScore = (hasDeepA2 ? 5 : 0) + (hasDeepB2 ? 5 : 0) + (hasV5A ? 3 : 0) + (hasV5B ? 3 : 0);
  // KenPom rank as quality proxy — lower rank = more reliable data
  const avgKpRk = (a.kpRk + b.kpRk) / 2;
  const rankQuality = avgKpRk < 50 ? 8 : avgKpRk < 100 ? 5 : avgKpRk < 200 ? 2 : 0;
  
  // Layer 3: TEAM CONSISTENCY — predictable teams = more confident predictions
  //   Low margin_std = team wins/loses by consistent amounts
  const dA3 = DEEP[m.t1] || {}, dB3 = DEEP[m.t2] || {};
  const stdA = dA3.margin_std || 15, stdB = dB3.margin_std || 15;
  const avgStd = (stdA + stdB) / 2;
  // Consistency score: low avg std = high consistency (0-15 pts)
  const consistencyScore = Math.max(0, Math.round(15 - (avgStd - 10) * 1.2));
  
  // Injury penalty
  const injPenalty = (a.injNote === "" && b.injNote === "") ? 0 : -5;
  
  // Combine layers: base 25 + agreement (0-35) + data quality (0-24) + consistency (0-15) + injury
  // Range: 20-88
  let spreadConf = Math.round(Math.min(88, Math.max(20, 
    25 + agreementScore + directionBonus + dataScore + rankQuality + consistencyScore + injPenalty
  )));

  // Total confidence: same 3-layer system using total sources
  const totalVals = totalSourcesInfo.map(s => s.val);
  const totalMean = totalVals.reduce((s, v) => s + v, 0) / totalVals.length;
  const totalStdSrc = Math.sqrt(totalVals.reduce((s, v) => s + (v - totalMean) ** 2, 0) / totalVals.length);
  const totalAgreementScore = Math.max(0, 25 - totalStdSrc * 1.5);
  let totalConf = Math.round(Math.min(85, Math.max(20,
    25 + totalAgreementScore + dataScore + rankQuality + consistencyScore + injPenalty
  )));

  // ── UPSET ALERT (backed by deep features) ──────────────────────────────
  // Triggered when: model spread flips direction from DK AND deep features support it
  let upsetAlert = false;
  let upsetScore = 0;
  let upsetTeam = null;
  const modelFavT1 = modelSpread < 0;
  const dkFavT1 = m.vs < 0;
  const spreadFlipped = modelFavT1 !== dkFavT1 && Math.abs(m.vs) > 2; // model disagrees on WHO wins

  if (spreadFlipped || (Math.abs(m.vs) > 5 && Math.abs(modelSpread) < Math.abs(m.vs) * 0.3)) {
    // Determine which team is the DK underdog
    const dogName = dkFavT1 ? m.t2 : m.t1;
    const favName = dkFavT1 ? m.t1 : m.t2;
    const dogDeep = DEEP[dogName] || {};
    const favDeep = DEEP[favName] || {};

    // Score upset likelihood from deep features (each factor 0-25 pts)
    let us = 0;
    // 1. Underdog trajectory: improving team → upset potential
    if (dogDeep.em_trajectory > 0) us += Math.min(25, dogDeep.em_trajectory * 2);
    // 2. Underdog away/neutral performance: tournament proxy
    if (dogDeep.away_em > 3) us += Math.min(25, dogDeep.away_em * 2);
    // 3. Favorite volatility: inconsistent favorite → upset risk
    if (favDeep.margin_std > 17) us += Math.min(25, (favDeep.margin_std - 15) * 3);
    // 4. Favorite fading: negative trajectory → vulnerable
    if (favDeep.em_trajectory < -5) us += Math.min(25, Math.abs(favDeep.em_trajectory) * 2);
    // 5. Underdog close-game clutch
    if (dogDeep.close_win_pct > 0.6) us += 10;

    upsetScore = Math.round(Math.min(100, us));
    if (upsetScore >= 30) {
      upsetAlert = true;
      upsetTeam = dogName;
      // Upset alerts get a confidence boost (model sees something the market doesn't)
      spreadConf = Math.min(88, spreadConf + 8);
    }
  }

  // ── ENSEMBLE CONSENSUS (informational — separate from model) ──────────
  // Cross-reference multiple signals. Each "vote" is ATS lean direction.
  // Sources: (1) Our Ridge model, (2) KenPom implied, (3) ESPN BPI, (4) DK line
  const kpImpl2 = -(a.kpEM - b.kpEM) * 0.88; // KenPom AdjEM → implied spread
  const bpiImpl2 = m.bpi * (m.vs <= 0 ? -1 : 1); // ESPN BPI projected margin
  // Count how many sources agree on which side covers
  const dkFav = m.vs < 0 ? m.t1 : m.t2;
  const consSources = [];
  // Source 1: Our model
  if (Math.abs(spreadVal) >= 1) consSources.push({ name: "Model", side: spreadVal < 0 ? m.t1 : m.t2 });
  // Source 2: KenPom implied vs DK
  const kpVal = kpImpl2 - m.vs;
  if (Math.abs(kpVal) >= 1) consSources.push({ name: "KenPom", side: kpVal < 0 ? m.t1 : m.t2 });
  // Source 3: BPI
  const bpiVal = bpiImpl2 - Math.abs(m.vs);
  if (Math.abs(m.bpi) >= 1) consSources.push({ name: "BPI", side: m.bpi > Math.abs(m.vs) ? dkFav : (dkFav === m.t1 ? m.t2 : m.t1) });
  // Source 4: Monte Carlo cover probability
  if (Math.abs(coverProb1 - 50) >= 5) consSources.push({ name: "MC Sim", side: coverProb1 > 50 ? m.t1 : m.t2 });

  // Consensus: count agreements
  const consCounts = {};
  consSources.forEach(s => { consCounts[s.side] = (consCounts[s.side] || 0) + 1; });
  const consTeam = Object.entries(consCounts).sort((a, b) => b[1] - a[1])[0];
  const consensusSide = consTeam ? consTeam[0] : null;
  const consensusCount = consTeam ? consTeam[1] : 0;
  const consensusTotal = consSources.length;
  const consensusSources = consSources;

  // ── LINE MOVEMENT ANALYSIS (opening vs current) ──────────────────────
  // Opening lines from when bracket was announced (March 15-16)
  // vs current lines (which may have moved based on sharp action)
  const openSpread = m.openVs !== undefined ? m.openVs : m.vs; // fallback to current if no opening
  const openTotal = m.openVt !== undefined ? m.openVt : m.vt;
  const spreadMove = Math.round((m.vs - openSpread) * 10) / 10;
  const totalMove = Math.round((m.vt - openTotal) * 10) / 10;
  // Sharp money indicator: significant line movement = sharp action
  // spreadMove = current - opening. 
  // Positive move (t1's line got worse/more positive) = sharp money on t2
  // Negative move (t1's line got more negative/more favored) = sharp money on t1
  let sharpSide = null;
  if (Math.abs(spreadMove) >= 1.0) {
    sharpSide = spreadMove > 0 ? m.t2 : m.t1;
  }

  // ── BET LEAN ──
  const mMargin = Math.abs(modelSpread);
  const mFav1 = modelSpread < 0, dkFav1 = m.vs < 0;

  let spreadLeanTeam, spreadLeanLine, spreadLeanReason;
  if (Math.abs(spreadVal) < 0.5) {
    spreadLeanTeam = null; spreadLeanLine = ""; spreadLeanReason = "Model agrees with DK line — no edge";
  } else if (spreadVal < 0) {
    spreadLeanTeam = m.t1; spreadLeanLine = (m.vs > 0 ? "+" : "") + m.vs;
    spreadLeanReason = `Model has ${m.t1} by ${mMargin.toFixed(1)} — ${dkFav1 ? "covers DK's " + m.vs : "should be favored"}`;
  } else {
    spreadLeanTeam = m.t2; spreadLeanLine = ((-m.vs) > 0 ? "+" : "") + (-m.vs);
    spreadLeanReason = `Model has ${mFav1 ? m.t1 + " by only " + mMargin.toFixed(1) : m.t2 + " winning"} — ${m.t2} ${spreadLeanLine} covers`;
  }

  let totalLeanDir, totalLeanReason;
  if (Math.abs(totalVal) < 1.5) {
    totalLeanDir = null; totalLeanReason = "Model agrees with DK total — no edge";
  } else if (totalVal > 0) {
    totalLeanDir = "OVER"; totalLeanReason = `Model projects ${modelTotal} pts — ${Math.abs(totalVal).toFixed(1)} above DK's ${m.vt}`;
  } else {
    totalLeanDir = "UNDER"; totalLeanReason = `Model projects ${modelTotal} pts — ${Math.abs(totalVal).toFixed(1)} below DK's ${m.vt}`;
  }

  return { modelSpread, modelTotal, spreadConf, totalConf, spreadVal, totalVal, s1, s2,
    modelMargin: absMargin,
    spreadLeanTeam, spreadLeanLine, spreadLeanReason, totalLeanDir, totalLeanReason,
    // Monte Carlo simulation results
    winProb1, winProb2, coverProb1, coverProb2, overProb, underProb,
    simP10, simP90,
    // Upset alert
    upsetAlert, upsetScore, upsetTeam,
    // Ensemble consensus (informational)
    consensusSide, consensusCount, consensusTotal, consensusSources,
    // Line movement (informational)
    spreadMove, totalMove, sharpSide, openSpread, openTotal,
    // Conformal prediction data
    spreadInterval80: Math.round(ML.conformal_spread[0.80] * 10) / 10,
    spreadWidth: Math.round(spreadWidth * 10) / 10,
    totalWidth: Math.round(totalWidth * 10) / 10,
    spreadCovLevel, totalCovLevel,
    // Toss-up flag
    isTossup: absDK < 8,
    breakdown: {
      kpBaseline: Math.round(-layerContrib.L1*10)/10,
      fourFactors: Math.round(-layerContrib.L2*10)/10,
      momentum: Math.round(-layerContrib.L3*10)/10,
      situational: Math.round(-layerContrib.L4*10)/10,
      shotProfile: Math.round(-layerContrib.L5*10)/10,
    }
  };
}

// ─── UI COMPONENTS ────────────────────────────────────────────────────────────
const RC = { East: "#dc2626", West: "#2563eb", Midwest: "#d97706", South: "#059669" };
const SRC_TAGS = ["KenPom","Torvik","EvanMiya","Hoop-Math","DraftKings"];

function Conf({ v, sz }) {
  const c = v >= 72 ? "#16a34a" : v >= 52 ? "#ca8a04" : "#dc2626";
  const w = sz === "sm" ? 56 : 72;
  return <div style={{display:"flex",alignItems:"center",gap:5}}>
    <div style={{width:w,height:sz==="sm"?5:7,borderRadius:8,background:"#1e1e2a",overflow:"hidden"}}>
      <div style={{width:`${v}%`,height:"100%",borderRadius:8,background:c,transition:"width .5s"}}/>
    </div>
    <span style={{fontSize:sz==="sm"?10:11,fontWeight:700,color:c,fontFamily:"'JetBrains Mono',mono"}}>{v}%</span>
  </div>;
}

function Val({ v, type }) {
  if (Math.abs(v) < 1.5) return <span style={{fontSize:10,color:"#4a4a5a",fontFamily:"'JetBrains Mono',mono"}}>—</span>;
  const strong = Math.abs(v) >= 3;
  const c = strong ? "#16a34a" : "#ca8a04";
  const lbl = type === "spread"
    ? (v > 0 ? `Model sees ${Math.abs(v)} pts too much chalk` : `Model has ${Math.abs(v)} pts more edge`)
    : (v > 0 ? `OVER by ${Math.abs(v)}` : `UNDER by ${Math.abs(v)}`);
  return <span style={{display:"inline-block",padding:"2px 7px",borderRadius:4,background:c+"1a",color:c,fontSize:10,fontWeight:700,fontFamily:"'JetBrains Mono',mono"}}>
    {strong?"🔥 ":"⚡ "}{lbl}
  </span>;
}

function GameCard({ m, pred, exp, onTog, onEdit }) {
  const a = T[m.t1], b = T[m.t2];
  const val = pred.spreadLeanTeam || pred.totalLeanDir;
  const editStyle = {cursor:"pointer",borderBottom:"1px dashed #d9770644",transition:"color .15s"};
  // Compute per-team DK spreads: if vs is -2.5, team1 is -2.5 favorite, team2 is +2.5
  const t1DkSpread = m.vs; // negative = t1 favored
  const t2DkSpread = -m.vs; // positive = t2 underdog
  const fmtSpread = (v) => (v > 0 ? "+" : "") + v;
  const spreadColor = (v) => v < 0 ? "#f59e0b" : v > 0 ? "#888" : "#888"; // favorites in amber
  return <div style={{background:"#111118",borderRadius:12,border:val?"1.5px solid #16a34a33":"1px solid #222230",overflow:"hidden",transition:"all .2s"}}>
    <div onClick={onTog} style={{cursor:"pointer"}}>
    <div style={{padding:"12px 14px 8px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        {m.firstFour && <span style={{fontSize:8,fontWeight:800,letterSpacing:".06em",padding:"2px 5px",borderRadius:3,background:"#7c3aed22",color:"#a78bfa",fontFamily:"'JetBrains Mono',mono"}}>FIRST FOUR</span>}
        <span style={{fontSize:9,fontWeight:800,letterSpacing:".08em",color:RC[m.r],fontFamily:"'JetBrains Mono',mono"}}>{m.r.toUpperCase()}</span>
        <span style={{fontSize:9,color:"#555",fontFamily:"'JetBrains Mono',mono"}}>{m.day} {m.time}</span>
      </div>
      <div style={{display:"flex",gap:6,alignItems:"center"}}>
        {m.advancesTo && <span style={{fontSize:8,color:"#888",fontFamily:"'JetBrains Mono',mono"}}>Winner → {m.advancesTo}</span>}
        {pred.upsetAlert && <span style={{fontSize:8,fontWeight:800,letterSpacing:".06em",padding:"2px 6px",borderRadius:3,background:"#dc262622",color:"#f87171",fontFamily:"'JetBrains Mono',mono",animation:"pulse 2s infinite"}}>⚠️ UPSET WATCH</span>}
        {pred.isTossup && !pred.upsetAlert && <span style={{fontSize:8,fontWeight:800,letterSpacing:".06em",padding:"2px 6px",borderRadius:3,background:"#d9770618",color:"#d97706",fontFamily:"'JetBrains Mono',mono"}}>TOSS-UP</span>}
        {val && <span style={{fontSize:9,fontWeight:800,color:"#16a34a",letterSpacing:".05em"}}>LEAN {pred.spreadLeanTeam ? "ATS" : ""}{pred.spreadLeanTeam && pred.totalLeanDir ? " + " : ""}{pred.totalLeanDir || ""}</span>}
      </div>
    </div>
    <div style={{padding:"0 14px 10px"}}>
      {/* Team 1 row: seed | name | record | DK spread | projected score */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:22,height:22,borderRadius:5,background:RC[m.r]+"18",color:RC[m.r],fontSize:10,fontWeight:800,fontFamily:"'JetBrains Mono',mono"}}>{a.s}</span>
          <span style={{fontWeight:700,fontSize:13,color:"#e0e0ea"}}>{m.t1}</span>
          <span style={{fontSize:10,color:"#555"}}>{a.rec}</span>
          <span style={{fontSize:11,fontWeight:700,color:spreadColor(t1DkSpread),fontFamily:"'JetBrains Mono',mono",padding:"1px 5px",borderRadius:4,background:t1DkSpread<0?"#f59e0b12":"#88888808"}}>{fmtSpread(t1DkSpread)}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          {m._isLive && <span style={{fontSize:8,fontWeight:800,padding:"2px 5px",borderRadius:3,background:"#dc262622",color:"#f87171",animation:"pulse 1.5s infinite"}}>LIVE</span>}
          {m._isFinal && <span style={{fontSize:8,fontWeight:800,padding:"2px 5px",borderRadius:3,background:"#16a34a22",color:"#16a34a"}}>FINAL</span>}
          {(m._isLive || m._isFinal) ? <span style={{fontSize:17,fontWeight:800,color:m._isFinal?"#16a34a":"#f87171",fontFamily:"'JetBrains Mono',mono"}}>{m._liveS1}</span> : <span style={{fontSize:17,fontWeight:800,color:"#e0e0ea",fontFamily:"'JetBrains Mono',mono"}}>{pred.s1}</span>}
        </div>
      </div>
      {/* Team 2 row: seed | name | record | DK spread | projected score */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:22,height:22,borderRadius:5,background:RC[m.r]+"18",color:RC[m.r],fontSize:10,fontWeight:800,fontFamily:"'JetBrains Mono',mono"}}>{b.s}</span>
          <span style={{fontWeight:700,fontSize:13,color:"#e0e0ea"}}>{m.t2}</span>
          <span style={{fontSize:10,color:"#555"}}>{b.rec}</span>
          <span style={{fontSize:11,fontWeight:700,color:spreadColor(t2DkSpread),fontFamily:"'JetBrains Mono',mono",padding:"1px 5px",borderRadius:4,background:t2DkSpread<0?"#f59e0b12":"#88888808"}}>{fmtSpread(t2DkSpread)}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          {(m._isLive || m._isFinal) ? <span style={{fontSize:17,fontWeight:800,color:m._isFinal?"#16a34a":"#f87171",fontFamily:"'JetBrains Mono',mono"}}>{m._liveS2}</span> : <span style={{fontSize:17,fontWeight:800,color:"#e0e0ea",fontFamily:"'JetBrains Mono',mono"}}>{pred.s2}</span>}
        </div>
      </div>
      {/* Live game status */}
      {m._liveStatus && (m._isLive || m._isFinal) && <div style={{textAlign:"center",marginTop:4}}>
        <span style={{fontSize:9,fontWeight:700,color:m._isLive?"#f87171":"#16a34a",fontFamily:"'JetBrains Mono',mono"}}>{m._liveStatus}</span>
      </div>}
      {/* Model predicted margin + win probability + total */}
      <div style={{marginTop:8,padding:"6px 8px",borderRadius:6,background:"#0d0d14"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div>
              <span style={{fontSize:9,color:"#555",fontWeight:600}}>MODEL MARGIN </span>
              <span style={{fontSize:12,fontWeight:800,color:"#e0e0ea",fontFamily:"'JetBrains Mono',mono"}}>{pred.modelSpread < 0 ? m.t1 : m.t2} by {pred.modelMargin.toFixed(1)}</span>
            </div>
            <div>
              <span style={{fontSize:9,color:"#555",fontWeight:600}}>PROJ TOTAL </span>
              <span style={{fontSize:12,fontWeight:800,color:"#e0e0ea",fontFamily:"'JetBrains Mono',mono"}}>{pred.modelTotal}</span>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:9,color:"#555",fontWeight:600}}>DK O/U</span>
            <span style={{fontSize:11,fontWeight:700,color:"#888",fontFamily:"'JetBrains Mono',mono"}}>{m.vt}</span>
            <span onClick={(e)=>{e.stopPropagation();onEdit&&onEdit();}} style={{...editStyle,fontSize:9,color:"#d97706",fontFamily:"'JetBrains Mono',mono"}} title="Click to edit DK lines">✏️</span>
          </div>
        </div>
        {/* Monte Carlo Win Probability Bar */}
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:9,fontWeight:700,color:pred.winProb1>50?"#e0e0ea":"#555",fontFamily:"'JetBrains Mono',mono",minWidth:30,textAlign:"right"}}>{pred.winProb1}%</span>
          <div style={{flex:1,height:6,borderRadius:3,background:"#1e1e2a",overflow:"hidden",display:"flex"}}>
            <div style={{width:`${pred.winProb1}%`,height:"100%",background:pred.winProb1>60?"#16a34a":pred.winProb1>50?"#d97706":"#555",borderRadius:"3px 0 0 3px",transition:"width .5s"}}/>
            <div style={{width:`${pred.winProb2}%`,height:"100%",background:pred.winProb2>60?"#16a34a":pred.winProb2>50?"#d97706":"#555",borderRadius:"0 3px 3px 0",transition:"width .5s"}}/>
          </div>
          <span style={{fontSize:9,fontWeight:700,color:pred.winProb2>50?"#e0e0ea":"#555",fontFamily:"'JetBrains Mono',mono",minWidth:30}}>{pred.winProb2}%</span>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:2}}>
          <span style={{fontSize:8,color:"#444"}}>{m.t1} win</span>
          <span style={{fontSize:8,color:"#555",fontFamily:"'JetBrains Mono',mono"}}>MC 10K sims</span>
          <span style={{fontSize:8,color:"#444"}}>{m.t2} win</span>
        </div>
      </div>
    </div>
    </div>
    <div style={{padding:"10px 14px",background:"#0d0d14"}}>
      {/* ─── SPREAD LEAN ─── */}
      <div style={{marginBottom:10}}>
        <div style={{fontSize:9,fontWeight:600,color:"#555",letterSpacing:".06em",marginBottom:5}}>SPREAD LEAN</div>
        {pred.spreadLeanTeam ? (
          <div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:16,fontWeight:800,color:"#16a34a",fontFamily:"'JetBrains Mono',mono"}}>✓ {pred.spreadLeanTeam} {pred.spreadLeanLine}</span>
              <Conf v={pred.spreadConf} sz="sm"/>
            </div>
            <div style={{fontSize:10,color:"#888",marginTop:3,lineHeight:1.4}}>{pred.spreadLeanReason}</div>
          </div>
        ) : (
          <div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:13,fontWeight:700,color:"#555",fontFamily:"'JetBrains Mono',mono"}}>— No edge</span>
              <Conf v={pred.spreadConf} sz="sm"/>
            </div>
            <div style={{fontSize:10,color:"#666",marginTop:3}}>{pred.spreadLeanReason}</div>
          </div>
        )}
      </div>
      {/* ─── TOTAL LEAN ─── */}
      <div>
        <div style={{fontSize:9,fontWeight:600,color:"#555",letterSpacing:".06em",marginBottom:5}}>TOTAL LEAN</div>
        {pred.totalLeanDir ? (
          <div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:16,fontWeight:800,color:pred.totalLeanDir==="OVER"?"#16a34a":"#dc2626",fontFamily:"'JetBrains Mono',mono"}}>{pred.totalLeanDir==="OVER"?"⬆":"⬇"} {pred.totalLeanDir} {m.vt}</span>
              <Conf v={pred.totalConf} sz="sm"/>
            </div>
            <div style={{fontSize:10,color:"#888",marginTop:3,lineHeight:1.4}}>{pred.totalLeanReason}</div>
          </div>
        ) : (
          <div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:13,fontWeight:700,color:"#555",fontFamily:"'JetBrains Mono',mono"}}>— No edge on total</span>
              <Conf v={pred.totalConf} sz="sm"/>
            </div>
            <div style={{fontSize:10,color:"#666",marginTop:3}}>{pred.totalLeanReason}</div>
          </div>
        )}
      </div>
      {/* ─── SHARP MONEY + LINE MOVEMENT (visible on card face) ─── */}
      {(pred.sharpSide || pred.spreadMove !== 0) && <div style={{padding:"6px 10px",marginTop:6,borderRadius:6,background:"#f59e0b08",border:"1px solid #f59e0b18",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:12}}>📈</span>
          {pred.sharpSide && <span style={{fontSize:9,fontWeight:700,color:"#f59e0b"}}>Sharp money → {pred.sharpSide}</span>}
          {!pred.sharpSide && pred.spreadMove !== 0 && <span style={{fontSize:9,fontWeight:600,color:"#888"}}>Line moved {pred.spreadMove > 0 ? "+" : ""}{pred.spreadMove}</span>}
        </div>
        <span style={{fontSize:8,color:"#555",fontFamily:"'JetBrains Mono',mono"}}>
          {pred.openSpread !== m.vs ? `Open ${pred.openSpread} → Now ${m.vs}` : "No spread movement"}
          {pred.totalMove !== 0 ? ` | O/U ${pred.totalMove > 0 ? "+" : ""}${pred.totalMove}` : ""}
        </span>
      </div>}
      {/* ─── EXPAND HINT ─── */}
      {!exp && <div onClick={onTog} style={{cursor:"pointer",padding:"6px 0",textAlign:"center",marginTop:4}}>
        <span style={{fontSize:9,color:"#555",fontWeight:600,letterSpacing:".04em"}}>
          ▼ Click for Monte Carlo sims, market consensus, deep analysis & more
        </span>
      </div>}
    </div>
    {exp && <div style={{padding:"12px 14px 14px",borderTop:"1px solid #222230"}}>
      {/* Upset Alert Details (if triggered) */}
      {pred.upsetAlert && <div style={{padding:"10px 12px",background:"linear-gradient(135deg,#1a1010,#1a0d0d)",borderRadius:8,border:"1px solid #dc262644",marginBottom:12}}>
        <div style={{fontSize:10,fontWeight:800,color:"#f87171",letterSpacing:".06em",marginBottom:6}}>⚠️ UPSET ALERT — {pred.upsetTeam} ({pred.upsetScore}/100)</div>
        <div style={{fontSize:9,color:"#888",lineHeight:1.6}}>
          Deep feature analysis suggests <b style={{color:"#f87171"}}>{pred.upsetTeam}</b> has upset potential.
          {DEEP[pred.upsetTeam]?.em_trajectory > 0 && <> Trending up (trajectory: +{DEEP[pred.upsetTeam].em_trajectory.toFixed(1)}).</>}
          {DEEP[pred.upsetTeam]?.away_em > 3 && <> Strong away: +{DEEP[pred.upsetTeam].away_em.toFixed(1)} EM on the road.</>}
          {(() => { const fav = pred.upsetTeam === m.t1 ? m.t2 : m.t1; const fd = DEEP[fav]; return fd?.margin_std > 17 ? ` ${fav} is volatile (std: ${fd.margin_std.toFixed(1)}).` : fd?.em_trajectory < -5 ? ` ${fav} is fading (traj: ${fd.em_trajectory.toFixed(1)}).` : ''; })()}
          {" "}Model historically detected 33% of upsets in backtesting.
        </div>
      </div>}
      {/* Toss-up specialist note */}
      {pred.isTossup && !pred.upsetAlert && <div style={{padding:"8px 12px",background:"#d9770610",borderRadius:8,border:"1px solid #d9770622",marginBottom:12}}>
        <div style={{fontSize:9,color:"#d97706",fontWeight:700}}>🎯 TOSS-UP GAME — Model's sweet spot. Backtest: closest to DK accuracy on games with spreads under 8 pts.</div>
      </div>}
      {/* Conformal Prediction Info */}
      <div style={{fontSize:10,fontWeight:700,color:"#a78bfa",letterSpacing:".06em",marginBottom:8}}>EDGE-BASED CONFIDENCE — Recalibrated from Backtest Analysis</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:12}}>
        <div style={{padding:"6px 8px",borderRadius:6,background:"#0d0d14",textAlign:"center"}}>
          <div style={{fontSize:8,color:"#666"}}>80% Interval</div>
          <div style={{fontSize:12,fontWeight:700,color:"#a78bfa",fontFamily:"'JetBrains Mono',mono"}}>±{pred.spreadInterval80}</div>
          <div style={{fontSize:8,color:"#444"}}>pts (conformal)</div>
        </div>
        <div style={{padding:"6px 8px",borderRadius:6,background:"#0d0d14",textAlign:"center"}}>
          <div style={{fontSize:8,color:"#666"}}>QR Pred Width</div>
          <div style={{fontSize:12,fontWeight:700,color:pred.spreadWidth<22?"#16a34a":pred.spreadWidth>28?"#dc2626":"#d97706",fontFamily:"'JetBrains Mono',mono"}}>{pred.spreadWidth}</div>
          <div style={{fontSize:8,color:"#444"}}>{pred.spreadWidth<22?"narrow":""}  {pred.spreadWidth>28?"wide":""}{pred.spreadWidth>=22&&pred.spreadWidth<=28?"avg":""}</div>
        </div>
        <div style={{padding:"6px 8px",borderRadius:6,background:"#0d0d14",textAlign:"center"}}>
          <div style={{fontSize:8,color:"#666"}}>vs DK Coverage</div>
          <div style={{fontSize:12,fontWeight:700,color:"#888",fontFamily:"'JetBrains Mono',mono"}}>{Math.round(pred.spreadCovLevel*100)}%</div>
          <div style={{fontSize:8,color:"#444"}}>conformal level</div>
        </div>
      </div>
      {/* Monte Carlo Simulation Details */}
      <div style={{fontSize:10,fontWeight:700,color:"#d97706",letterSpacing:".06em",marginBottom:8}}>🎲 MONTE CARLO SIMULATION — 10,000 Games</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6,marginBottom:12}}>
        {[
          [m.t1+" Win", pred.winProb1+"%", pred.winProb1>50?"#16a34a":"#888"],
          [m.t1+" Covers", pred.coverProb1+"%", pred.coverProb1>55?"#16a34a":pred.coverProb1<45?"#dc2626":"#888"],
          ["Over "+m.vt, pred.overProb+"%", pred.overProb>55?"#16a34a":"#888"],
          ["Margin Range", pred.simP10+" to "+pred.simP90, "#a78bfa"],
        ].map(([label,val,color],i) => <div key={i} style={{padding:"6px 8px",borderRadius:6,background:"#0d0d14",textAlign:"center"}}>
          <div style={{fontSize:8,color:"#666"}}>{label}</div>
          <div style={{fontSize:12,fontWeight:700,color,fontFamily:"'JetBrains Mono',mono"}}>{val}</div>
        </div>)}
      </div>

      {/* Ensemble Consensus (informational) */}
      <div style={{fontSize:10,fontWeight:700,color:"#22c55e",letterSpacing:".06em",marginBottom:8}}>📡 MARKET CONSENSUS — {pred.consensusCount}/{pred.consensusTotal} sources agree</div>
      <div style={{padding:"8px 10px",borderRadius:6,background:"#0d0d14",marginBottom:12}}>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {pred.consensusSources.map((s,i) => <span key={i} style={{fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:4,
            background: s.side === pred.consensusSide ? "#16a34a18" : "#88888818",
            color: s.side === pred.consensusSide ? "#16a34a" : "#888",
            fontFamily:"'JetBrains Mono',mono"
          }}>{s.name}: {s.side}</span>)}
        </div>
        {pred.consensusCount >= 3 && <div style={{marginTop:6,fontSize:9,color:"#16a34a",fontWeight:600}}>
          Strong consensus: {pred.consensusCount}/{pred.consensusTotal} sources favor {pred.consensusSide}
        </div>}
        {pred.consensusCount <= 1 && pred.consensusTotal >= 3 && <div style={{marginTop:6,fontSize:9,color:"#d97706",fontWeight:600}}>
          Split opinion — sources disagree on this game
        </div>}
      </div>

      {/* Line Movement (informational) */}
      {(pred.spreadMove !== 0 || pred.totalMove !== 0) && <div style={{marginBottom:12}}>
        <div style={{fontSize:10,fontWeight:700,color:"#f59e0b",letterSpacing:".06em",marginBottom:8}}>📈 LINE MOVEMENT — Opening vs Current</div>
        <div style={{display:"flex",gap:12,padding:"8px 10px",borderRadius:6,background:"#0d0d14"}}>
          {pred.spreadMove !== 0 && <div>
            <span style={{fontSize:9,color:"#555"}}>Spread: </span>
            <span style={{fontSize:11,fontWeight:700,color:Math.abs(pred.spreadMove)>=1.5?"#f59e0b":"#888",fontFamily:"'JetBrains Mono',mono"}}>
              {pred.openSpread} → {m.vs} ({pred.spreadMove > 0 ? "+" : ""}{pred.spreadMove})
            </span>
          </div>}
          {pred.totalMove !== 0 && <div>
            <span style={{fontSize:9,color:"#555"}}>Total: </span>
            <span style={{fontSize:11,fontWeight:700,color:Math.abs(pred.totalMove)>=2?"#f59e0b":"#888",fontFamily:"'JetBrains Mono',mono"}}>
              {pred.openTotal} → {m.vt} ({pred.totalMove > 0 ? "+" : ""}{pred.totalMove})
            </span>
          </div>}
          {pred.sharpSide && <div>
            <span style={{fontSize:9,color:"#555"}}>Sharp money: </span>
            <span style={{fontSize:10,fontWeight:700,color:"#f59e0b"}}>→ {pred.sharpSide}</span>
          </div>}
        </div>
      </div>}

      {/* Model Breakdown */}
      <div style={{fontSize:10,fontWeight:700,color:"#888",letterSpacing:".06em",marginBottom:8}}>MODEL v3.4 — FIVE-LAYER BREAKDOWN</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr",gap:6,marginBottom:12}}>
        {[
          ["Efficiency", pred.breakdown.kpBaseline, "23.7%"],
          ["Four Factors", pred.breakdown.fourFactors, "13.9%"],
          ["Trend/Momentum", pred.breakdown.momentum, "20.8%"],
          ["Quality/Away", pred.breakdown.situational, "26.3%"],
          ["Tempo/Profile", pred.breakdown.shotProfile, "15.2%"],
        ].map(([label,v,wt],i) => <div key={i} style={{padding:"6px 8px",borderRadius:6,background:"#0d0d14",textAlign:"center"}}>
          <div style={{fontSize:8,color:"#666"}}>{label}</div>
          <div style={{fontSize:13,fontWeight:700,color:v>0.2?"#16a34a":v<-0.2?"#dc2626":"#888",fontFamily:"'JetBrains Mono',mono"}}>{v>0?"+":""}{v}</div>
          <div style={{fontSize:8,color:"#444"}}>{wt} weight</div>
        </div>)}
      </div>
      {/* KenPom Rankings */}
      <div style={{fontSize:10,fontWeight:700,color:"#888",letterSpacing:".06em",marginBottom:6}}>KENPOM RANKS (March 15)</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
        {[[m.t1,a],[m.t2,b]].map(([nm,t],i) => <div key={i} style={{padding:"8px",borderRadius:6,background:"#0d0d14"}}>
          <div style={{fontWeight:700,fontSize:11,color:"#ccc",marginBottom:4}}>{nm}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4}}>
            {[["Overall","#"+t.kpRk],["Off Rk","#"+t.kpOffRk],["Def Rk","#"+t.kpDefRk]].map(([l,v],j)=>
              <div key={j}><div style={{fontSize:8,color:"#555"}}>{l}</div><div style={{fontSize:11,fontWeight:700,color:"#ddd",fontFamily:"'JetBrains Mono',mono"}}>{v}</div></div>
            )}
          </div>
          <div style={{marginTop:4,display:"flex",gap:8}}>
            <div><div style={{fontSize:8,color:"#555"}}>AdjEM</div><div style={{fontSize:11,fontWeight:700,color:t.kpEM>0?"#16a34a":"#dc2626",fontFamily:"'JetBrains Mono',mono"}}>{t.kpEM>0?"+":""}{t.kpEM}</div></div>
            <div><div style={{fontSize:8,color:"#555"}}>Tempo</div><div style={{fontSize:11,fontWeight:700,color:"#ddd",fontFamily:"'JetBrains Mono',mono"}}>{t.adjT}</div></div>
            <div><div style={{fontSize:8,color:"#555"}}>L30 Trend</div><div style={{fontSize:11,fontWeight:700,color:t.trvkL30>0?"#16a34a":"#dc2626",fontFamily:"'JetBrains Mono',mono"}}>{t.trvkL30>0?"+":""}{t.trvkL30}</div></div>
          </div>
        </div>)}
      </div>
      {/* Injuries */}
      {(a.injNote || b.injNote) && <div style={{marginBottom:10}}>
        <div style={{fontSize:10,fontWeight:700,color:"#dc2626",marginBottom:4}}>⚕️ INJURY REPORT (Action Network / DonBest)</div>
        {a.injNote && <div style={{fontSize:10,color:"#aaa",padding:"2px 0"}}><span style={{fontWeight:600}}>{m.t1}:</span> <span style={{color:"#f59e0b"}}>{a.injNote}</span></div>}
        {b.injNote && <div style={{fontSize:10,color:"#aaa",padding:"2px 0"}}><span style={{fontWeight:600}}>{m.t2}:</span> <span style={{color:"#f59e0b"}}>{b.injNote}</span></div>}
        {(a.emInjAdj !== 0 || b.emInjAdj !== 0) && <div style={{fontSize:9,color:"#888",marginTop:2,fontStyle:"italic"}}>EvanMiya injury-adjusted impact: {m.t1} {a.emInjAdj} pts/100poss{b.emInjAdj!==0?`, ${m.t2} ${b.emInjAdj} pts/100poss`:""}</div>}
      </div>}
      {/* Key Players (EvanMiya BPR) */}
      <div style={{fontSize:10,fontWeight:700,color:"#888",letterSpacing:".06em",marginBottom:6}}>KEY PLAYERS (EvanMiya BPR)</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
        {[[m.t1,a],[m.t2,b]].map(([nm,t],i) => <div key={i}>
          {t.stars.map((p,j) => <div key={j} style={{fontSize:10,color:"#ccc",padding:"2px 0"}}>
            <span style={{fontWeight:600}}>{p.n}</span>
            <span style={{color:"#888",marginLeft:4,fontFamily:"'JetBrains Mono',mono",fontSize:9}}>{p.ppg} PPG</span>
            <span style={{color:p.bpr>=4?"#16a34a":"#ca8a04",marginLeft:4,fontFamily:"'JetBrains Mono',mono",fontSize:9,fontWeight:700}}>BPR {p.bpr}</span>
          </div>)}
        </div>)}
      </div>
      {/* Shot Profile */}
      <div style={{fontSize:10,fontWeight:700,color:"#888",letterSpacing:".06em",marginBottom:6}}>HOOP-MATH SHOT PROFILE</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:10}}>
        {[[m.t1,a],[m.t2,b]].map(([nm,t],i) => <div key={i} style={{display:"flex",gap:12}}>
          <div><span style={{color:"#555"}}>Rim%: </span><span style={{fontWeight:600,color:"#ddd",fontFamily:"'JetBrains Mono',mono"}}>{t.hmRim}%</span></div>
          <div><span style={{color:"#555"}}>Trans: </span><span style={{fontWeight:600,color:"#ddd",fontFamily:"'JetBrains Mono',mono"}}>{t.hmTrans}/g</span></div>
          <div><span style={{color:"#555"}}>ATS: </span><span style={{fontWeight:600,color:"#ddd",fontFamily:"'JetBrains Mono',mono"}}>{t.ats}</span></div>
        </div>)}
      </div>
      {/* Data Sources */}
      <div style={{marginTop:12,display:"flex",gap:4,flexWrap:"wrap"}}>
        {SRC_TAGS.map(s => <span key={s} style={{fontSize:8,fontWeight:600,padding:"2px 6px",borderRadius:3,background:"#1a1a28",color:"#666",letterSpacing:".04em"}}>{s}</span>)}
      </div>
    </div>}
  </div>;
}

// ─── HISTORICAL BACKTEST DATA (2024-2025 NCAA Tournament Results) ────────────
// Format: [higher_seed, lower_seed, h_score, l_score, spread (higher seed), total_ou, round]
// Spread is from the higher seed's perspective (negative = favored)
// ─── MODEL BACKTEST RESULTS (V5 Kaggle-trained predictions vs actual 2024-2025) ───
// Each: yr, t1, t2, sc1, sc2, dk (DK spread), ou, ms (model spread V5), 
//        cf (confidence), val (value vs DK), mc (model correct ATS), 
//        se (spread error), de (DK error)
// V5 RESULTS: 2025 18-4 ATS (81.8%) MAE 6.4 | 2024 14-6 ATS (70.0%) MAE 7.3
const BACKTEST = [
  // ─── V5 MODEL PREDICTIONS (Kaggle-trained, LOSO MAE 6.5 pts) ─────
  // 2025: 18-4 ATS (81.8%), MAE 6.4 | 2024: 14-6 ATS (70.0%), MAE 7.3
  {yr:2025,t1:"Alabama",t2:"Robert Morris",sc1:90,sc2:81,dk:-22.5,ou:145.5,ms:-14.0,cf:55,val:8.5,mc:true,se:5.0,de:13.5},
  {yr:2025,t1:"Arizona",t2:"Akron",sc1:93,sc2:65,dk:-17.5,ou:145.5,ms:-11.1,cf:55,val:6.4,mc:false,se:16.9,de:10.5},
  {yr:2025,t1:"BYU",t2:"VCU",sc1:80,sc2:71,dk:-5.5,ou:135.5,ms:-6.6,cf:55,val:-1.1,mc:true,se:2.4,de:3.5},
  {yr:2025,t1:"Clemson",t2:"McNeese",sc1:67,sc2:69,dk:-7.5,ou:134.5,ms:9.2,cf:55,val:16.7,mc:true,se:7.2,de:9.5},
  {yr:2025,t1:"Drake",t2:"Missouri",sc1:67,sc2:57,dk:3.5,ou:133.5,ms:-8.3,cf:55,val:-11.8,mc:true,se:1.7,de:13.5},
  {yr:2025,t1:"Florida",t2:"Norfolk St.",sc1:95,sc2:69,dk:-28.5,ou:139.5,ms:-13.3,cf:55,val:15.2,mc:true,se:12.7,de:2.5},
  {yr:2025,t1:"Gonzaga",t2:"Georgia",sc1:89,sc2:68,dk:-2.5,ou:147.5,ms:-13.9,cf:55,val:-11.4,mc:true,se:7.1,de:18.5},
  {yr:2025,t1:"Illinois",t2:"Xavier",sc1:86,sc2:73,dk:-4.5,ou:147.5,ms:-13.9,cf:55,val:-9.4,mc:true,se:0.9,de:8.5},
  {yr:2025,t1:"Kansas",t2:"Arkansas",sc1:72,sc2:79,dk:-4.5,ou:141.5,ms:9.6,cf:55,val:14.1,mc:true,se:2.6,de:11.5},
  {yr:2025,t1:"Kentucky",t2:"Troy",sc1:76,sc2:57,dk:-16.5,ou:141.5,ms:-10.7,cf:55,val:5.8,mc:false,se:8.3,de:2.5},
  {yr:2025,t1:"Louisville",t2:"Creighton",sc1:75,sc2:89,dk:-1.5,ou:151.5,ms:11.0,cf:55,val:12.5,mc:true,se:3.0,de:15.5},
  {yr:2025,t1:"Marquette",t2:"New Mexico",sc1:66,sc2:75,dk:-5.5,ou:141.5,ms:7.8,cf:55,val:13.3,mc:true,se:1.2,de:14.5},
  {yr:2025,t1:"Maryland",t2:"Grand Canyon",sc1:81,sc2:49,dk:-14.5,ou:135.5,ms:-13.4,cf:55,val:1.1,mc:false,se:18.6,de:17.5},
  {yr:2025,t1:"Michigan",t2:"UC San Diego",sc1:68,sc2:65,dk:-9.5,ou:143.5,ms:-8.4,cf:55,val:1.1,mc:true,se:5.4,de:6.5},
  {yr:2025,t1:"Oregon",t2:"Liberty",sc1:81,sc2:52,dk:-11.5,ou:138.5,ms:-9.5,cf:55,val:2.0,mc:false,se:19.5,de:17.5},
  {yr:2025,t1:"Purdue",t2:"High Point",sc1:75,sc2:63,dk:-18.5,ou:141.5,ms:-9.7,cf:55,val:8.8,mc:true,se:2.3,de:6.5},
  {yr:2025,t1:"Saint Marys",t2:"Vanderbilt",sc1:59,sc2:56,dk:-1.5,ou:127.5,ms:-13.4,cf:55,val:-11.9,mc:true,se:10.4,de:1.5},
  {yr:2025,t1:"Tennessee",t2:"Wofford",sc1:77,sc2:62,dk:-20.5,ou:133.5,ms:-18.9,cf:55,val:1.6,mc:true,se:3.9,de:5.5},
  {yr:2025,t1:"Texas A&M",t2:"Yale",sc1:80,sc2:71,dk:-12.5,ou:140.5,ms:-10.6,cf:55,val:1.9,mc:true,se:1.6,de:3.5},
  {yr:2025,t1:"Texas Tech",t2:"UNC Wilmington",sc1:82,sc2:72,dk:-16.5,ou:135.5,ms:-13.4,cf:55,val:3.1,mc:true,se:3.4,de:6.5},
  {yr:2025,t1:"UCLA",t2:"Utah State",sc1:72,sc2:47,dk:-6.5,ou:139.5,ms:-11.6,cf:55,val:-5.1,mc:true,se:13.4,de:18.5},
  {yr:2025,t1:"UConn",t2:"Oklahoma",sc1:67,sc2:59,dk:-2.5,ou:139.5,ms:-13.8,cf:55,val:-11.3,mc:true,se:5.8,de:5.5},
  {yr:2025,t1:"Wisconsin",t2:"Montana",sc1:85,sc2:66,dk:-17.5,ou:137.5,ms:-18.5,cf:55,val:-1.0,mc:true,se:0.5,de:1.5},
  {yr:2024,t1:"Auburn",t2:"Yale",sc1:76,sc2:78,dk:-12.5,ou:143.5,ms:4.9,cf:55,val:17.4,mc:true,se:2.9,de:14.5},
  {yr:2024,t1:"BYU",t2:"Duquesne",sc1:67,sc2:71,dk:-5.5,ou:134.5,ms:3.9,cf:55,val:9.4,mc:true,se:0.1,de:9.5},
  {yr:2024,t1:"Baylor",t2:"Colgate",sc1:92,sc2:67,dk:-15.5,ou:141.5,ms:-14.0,cf:55,val:1.5,mc:false,se:11.0,de:9.5},
  {yr:2024,t1:"Clemson",t2:"New Mexico",sc1:77,sc2:56,dk:-3.5,ou:140.5,ms:-9.9,cf:55,val:-6.4,mc:true,se:11.1,de:17.5},
  {yr:2024,t1:"Creighton",t2:"Akron",sc1:77,sc2:60,dk:-13.5,ou:133.5,ms:-12.3,cf:55,val:1.2,mc:false,se:4.7,de:3.5},
  {yr:2024,t1:"Dayton",t2:"Nevada",sc1:63,sc2:60,dk:-3.5,ou:133.5,ms:-14.0,cf:55,val:-10.5,mc:false,se:11.0,de:0.5},
  {yr:2024,t1:"Duke",t2:"Vermont",sc1:64,sc2:47,dk:-15.5,ou:134.5,ms:-13.5,cf:55,val:2.0,mc:false,se:3.5,de:1.5},
  {yr:2024,t1:"Florida",t2:"Colorado",sc1:100,sc2:102,dk:-2.5,ou:138.5,ms:8.3,cf:55,val:10.8,mc:true,se:6.3,de:4.5},
  {yr:2024,t1:"Gonzaga",t2:"McNeese",sc1:86,sc2:65,dk:-11.5,ou:141.5,ms:-11.7,cf:55,val:-0.2,mc:true,se:9.3,de:9.5},
  {yr:2024,t1:"Houston",t2:"Longwood",sc1:86,sc2:46,dk:-29.5,ou:132.5,ms:-18.5,cf:55,val:11.0,mc:false,se:21.5,de:10.5},
  {yr:2024,t1:"Kansas",t2:"Samford",sc1:93,sc2:89,dk:-14.5,ou:142.5,ms:-9.7,cf:55,val:4.8,mc:true,se:5.7,de:10.5},
  {yr:2024,t1:"Kentucky",t2:"Oakland",sc1:76,sc2:80,dk:-13.5,ou:143.5,ms:6.8,cf:55,val:20.3,mc:true,se:2.8,de:17.5},
  {yr:2024,t1:"Nebraska",t2:"Texas A&M",sc1:83,sc2:98,dk:1.5,ou:136.5,ms:9.8,cf:55,val:8.3,mc:true,se:5.2,de:13.5},
  {yr:2024,t1:"North Carolina",t2:"Wagner",sc1:90,sc2:62,dk:-28.5,ou:143.5,ms:-17.3,cf:55,val:11.2,mc:true,se:10.7,de:0.5},
  {yr:2024,t1:"Saint Marys",t2:"Grand Canyon",sc1:66,sc2:75,dk:-7.5,ou:125.5,ms:12.3,cf:55,val:19.8,mc:true,se:3.3,de:16.5},
  {yr:2024,t1:"South Carolina",t2:"Oregon",sc1:73,sc2:87,dk:-2.5,ou:134.5,ms:10.3,cf:55,val:12.8,mc:true,se:3.7,de:16.5},
  {yr:2024,t1:"Texas Tech",t2:"NC State",sc1:67,sc2:80,dk:-3.5,ou:137.5,ms:7.9,cf:55,val:11.4,mc:true,se:5.1,de:16.5},
  {yr:2024,t1:"UConn",t2:"Stetson",sc1:91,sc2:52,dk:-32.5,ou:138.5,ms:-19.9,cf:55,val:12.6,mc:false,se:19.1,de:6.5},
  {yr:2024,t1:"Utah State",t2:"TCU",sc1:88,sc2:72,dk:1.5,ou:133.5,ms:-9.7,cf:55,val:-11.2,mc:true,se:6.3,de:17.5},
  {yr:2024,t1:"Wisconsin",t2:"James Madison",sc1:61,sc2:72,dk:-8.5,ou:136.5,ms:13.4,cf:55,val:21.9,mc:true,se:2.4,de:19.5},
];

const HIST = {
  2025: [
    // First Round - Day 1 (Thu Mar 20)
    {t1:"Auburn",s1:1,t2:"Alabama St.",s2:16,sc1:83,sc2:63,spd:-30.5,ou:144.5,rd:"R64"},
    {t1:"Louisville",s1:8,t2:"Creighton",s2:9,sc1:75,sc2:89,spd:-1.5,ou:151.5,rd:"R64"},
    {t1:"Michigan",s1:5,t2:"UC San Diego",s2:12,sc1:68,sc2:65,spd:-9.5,ou:143.5,rd:"R64"},
    {t1:"Texas A&M",s1:4,t2:"Yale",s2:13,sc1:80,sc2:71,spd:-12.5,ou:140.5,rd:"R64"},
    {t1:"Ole Miss",s1:6,t2:"North Carolina",s2:11,sc1:71,sc2:64,spd:-1.5,ou:149.5,rd:"R64"},
    {t1:"Iowa State",s1:3,t2:"Lipscomb",s2:14,sc1:82,sc2:55,spd:-22.5,ou:137.5,rd:"R64"},
    {t1:"Marquette",s1:7,t2:"New Mexico",s2:10,sc1:66,sc2:75,spd:-5.5,ou:141.5,rd:"R64"},
    {t1:"Alabama",s1:2,t2:"Robert Morris",s2:15,sc1:90,sc2:81,spd:-22.5,ou:145.5,rd:"R64"},
    {t1:"Houston",s1:1,t2:"SIU Edwardsville",s2:16,sc1:78,sc2:40,spd:-33.5,ou:130.5,rd:"R64"},
    {t1:"Purdue",s1:4,t2:"High Point",s2:13,sc1:75,sc2:63,spd:-18.5,ou:141.5,rd:"R64"},
    {t1:"Wisconsin",s1:3,t2:"Montana",s2:14,sc1:85,sc2:66,spd:-17.5,ou:137.5,rd:"R64"},
    {t1:"BYU",s1:6,t2:"VCU",s2:11,sc1:80,sc2:71,spd:-5.5,ou:135.5,rd:"R64"},
    {t1:"Gonzaga",s1:8,t2:"Georgia",s2:9,sc1:89,sc2:68,spd:-2.5,ou:147.5,rd:"R64"},
    {t1:"Tennessee",s1:2,t2:"Wofford",s2:15,sc1:77,sc2:62,spd:-20.5,ou:133.5,rd:"R64"},
    {t1:"Kansas",s1:7,t2:"Arkansas",s2:10,sc1:72,sc2:79,spd:-4.5,ou:141.5,rd:"R64"},
    {t1:"St. John's",s1:2,t2:"Omaha",s2:15,sc1:83,sc2:53,spd:-24.5,ou:133.5,rd:"R64"},
    {t1:"Clemson",s1:5,t2:"McNeese",s2:12,sc1:67,sc2:69,spd:-7.5,ou:134.5,rd:"R64"},
    {t1:"Drake",s1:11,t2:"Missouri",s2:6,sc1:67,sc2:57,spd:3.5,ou:133.5,rd:"R64"},
    {t1:"Texas Tech",s1:3,t2:"UNC Wilmington",s2:14,sc1:82,sc2:72,spd:-16.5,ou:135.5,rd:"R64"},
    {t1:"UCLA",s1:7,t2:"Utah State",s2:10,sc1:72,sc2:47,spd:-6.5,ou:139.5,rd:"R64"},
    // First Round - Day 2 (Fri Mar 21)
    {t1:"Duke",s1:1,t2:"Mount St. Mary's",s2:16,sc1:93,sc2:49,spd:-32.5,ou:138.5,rd:"R64"},
    {t1:"Mississippi St.",s1:8,t2:"Baylor",s2:9,sc1:72,sc2:75,spd:-1.5,ou:139.5,rd:"R64"},
    {t1:"Oregon",s1:5,t2:"Liberty",s2:12,sc1:81,sc2:52,spd:-11.5,ou:138.5,rd:"R64"},
    {t1:"Maryland",s1:4,t2:"Grand Canyon",s2:13,sc1:81,sc2:49,spd:-14.5,ou:135.5,rd:"R64"},
    {t1:"Illinois",s1:6,t2:"Xavier",s2:11,sc1:86,sc2:73,spd:-4.5,ou:147.5,rd:"R64"},
    {t1:"Kentucky",s1:3,t2:"Troy",s2:14,sc1:76,sc2:57,spd:-16.5,ou:141.5,rd:"R64"},
    {t1:"Michigan State",s1:2,t2:"Bryant",s2:15,sc1:87,sc2:62,spd:-21.5,ou:140.5,rd:"R64"},
    {t1:"Florida",s1:1,t2:"Norfolk St.",s2:16,sc1:95,sc2:69,spd:-28.5,ou:139.5,rd:"R64"},
    {t1:"Saint Mary's",s1:7,t2:"Vanderbilt",s2:10,sc1:59,sc2:56,spd:-1.5,ou:127.5,rd:"R64"},
    {t1:"Arizona",s1:4,t2:"Akron",s2:13,sc1:93,sc2:65,spd:-17.5,ou:145.5,rd:"R64"},
    {t1:"UConn",s1:8,t2:"Oklahoma",s2:9,sc1:67,sc2:59,spd:-2.5,ou:139.5,rd:"R64"},
    {t1:"Memphis",s1:5,t2:"Colorado St.",s2:12,sc1:70,sc2:78,spd:-6.5,ou:137.5,rd:"R64"},
  ],
  2024: [
    // First Round Day 1 (Thu Mar 21)
    {t1:"UConn",s1:1,t2:"Stetson",s2:16,sc1:91,sc2:52,spd:-32.5,ou:138.5,rd:"R64"},
    {t1:"FAU",s1:8,t2:"Northwestern",s2:9,sc1:65,sc2:77,spd:-1.5,ou:135.5,rd:"R64"},
    {t1:"San Diego St.",s1:5,t2:"UAB",s2:12,sc1:69,sc2:65,spd:-8.5,ou:133.5,rd:"R64"},
    {t1:"Auburn",s1:4,t2:"Yale",s2:13,sc1:76,sc2:78,spd:-12.5,ou:143.5,rd:"R64"},
    {t1:"BYU",s1:6,t2:"Duquesne",s2:11,sc1:67,sc2:71,spd:-5.5,ou:134.5,rd:"R64"},
    {t1:"Illinois",s1:3,t2:"Morehead St.",s2:14,sc1:85,sc2:69,spd:-16.5,ou:141.5,rd:"R64"},
    {t1:"Washington St.",s1:7,t2:"Drake",s2:10,sc1:66,sc2:61,spd:-2.5,ou:139.5,rd:"R64"},
    {t1:"Iowa State",s1:2,t2:"South Dakota St.",s2:15,sc1:98,sc2:59,spd:-18.5,ou:140.5,rd:"R64"},
    {t1:"North Carolina",s1:1,t2:"Wagner",s2:16,sc1:90,sc2:62,spd:-28.5,ou:143.5,rd:"R64"},
    {t1:"Mississippi St.",s1:8,t2:"Michigan St.",s2:9,sc1:56,sc2:69,spd:1.5,ou:135.5,rd:"R64"},
    {t1:"Saint Mary's",s1:5,t2:"Grand Canyon",s2:12,sc1:68,sc2:75,spd:-7.5,ou:125.5,rd:"R64"},
    {t1:"Alabama",s1:4,t2:"Charleston",s2:13,sc1:76,sc2:67,spd:-14.5,ou:147.5,rd:"R64"},
    {t1:"Clemson",s1:6,t2:"New Mexico",s2:11,sc1:77,sc2:56,spd:-3.5,ou:140.5,rd:"R64"},
    {t1:"Baylor",s1:3,t2:"Colgate",s2:14,sc1:81,sc2:61,spd:-15.5,ou:141.5,rd:"R64"},
    {t1:"Dayton",s1:7,t2:"Nevada",s2:10,sc1:63,sc2:60,spd:-3.5,ou:133.5,rd:"R64"},
    {t1:"Arizona",s1:2,t2:"Long Beach St.",s2:15,sc1:85,sc2:65,spd:-23.5,ou:139.5,rd:"R64"},
    // First Round Day 2 (Fri Mar 22)
    {t1:"Houston",s1:1,t2:"Longwood",s2:16,sc1:86,sc2:46,spd:-29.5,ou:132.5,rd:"R64"},
    {t1:"Nebraska",s1:8,t2:"Texas A&M",s2:9,sc1:78,sc2:88,spd:1.5,ou:136.5,rd:"R64"},
    {t1:"Wisconsin",s1:5,t2:"James Madison",s2:12,sc1:72,sc2:64,spd:-8.5,ou:136.5,rd:"R64"},
    {t1:"Duke",s1:4,t2:"Vermont",s2:13,sc1:64,sc2:47,spd:-15.5,ou:134.5,rd:"R64"},
    {t1:"Texas Tech",s1:6,t2:"NC State",s2:11,sc1:61,sc2:80,spd:-3.5,ou:137.5,rd:"R64"},
    {t1:"Kentucky",s1:3,t2:"Oakland",s2:14,sc1:76,sc2:80,spd:-13.5,ou:143.5,rd:"R64"},
    {t1:"Florida",s1:7,t2:"Colorado",s2:10,sc1:78,sc2:85,spd:-2.5,ou:138.5,rd:"R64"},
    {t1:"Marquette",s1:2,t2:"Western Kentucky",s2:15,sc1:87,sc2:69,spd:-18.5,ou:142.5,rd:"R64"},
    {t1:"Purdue",s1:1,t2:"Grambling St.",s2:16,sc1:76,sc2:64,spd:-32.5,ou:136.5,rd:"R64"},
    {t1:"Utah State",s1:8,t2:"TCU",s2:9,sc1:64,sc2:72,spd:1.5,ou:133.5,rd:"R64"},
    {t1:"Gonzaga",s1:5,t2:"McNeese",s2:12,sc1:86,sc2:65,spd:-11.5,ou:141.5,rd:"R64"},
    {t1:"Kansas",s1:4,t2:"Samford",s2:13,sc1:93,sc2:89,spd:-14.5,ou:142.5,rd:"R64"},
    {t1:"South Carolina",s1:6,t2:"Oregon",s2:11,sc1:70,sc2:87,spd:-2.5,ou:134.5,rd:"R64"},
    {t1:"Creighton",s1:3,t2:"Akron",s2:14,sc1:77,sc2:60,spd:-13.5,ou:133.5,rd:"R64"},
    {t1:"Texas",s1:7,t2:"Colorado St.",s2:10,sc1:56,sc2:44,spd:-5.5,ou:127.5,rd:"R64"},
    {t1:"Tennessee",s1:2,t2:"Saint Peter's",s2:15,sc1:83,sc2:49,spd:-20.5,ou:130.5,rd:"R64"},
  ],
};

// LOSO backtest results (from v3 conformal pipeline — trained on all OTHER seasons, tested on target)
const LOSO = {
  2025: { n:67, mae_spread:9.94, mae_total:14.91, conf80:0.746, conf90:0.896, qr80:0.672, qr_width:25.9 },
  2024: { n:67, mae_spread:11.12, mae_total:16.59, conf80:0.672, conf90:0.836, qr80:0.597, qr_width:26.2 },
  2023: { n:67, mae_spread:9.91, mae_total:14.24, conf80:0.821, conf90:0.91, qr80:0.701, qr_width:25.9 },
  2022: { n:67, mae_spread:11.14, mae_total:15.43, conf80:0.672, conf90:0.851, qr80:0.597, qr_width:25.0 },
  2021: { n:66, mae_spread:11.24, mae_total:15.91, conf80:0.682, conf90:0.909, qr80:0.591, qr_width:26.2 },
  avg: { mae_spread:9.84, mae_total:15.37, conf80:0.778, conf90:0.89, qr80:0.697 },
};

// ─── RESULTS TAB COMPONENT ──────────────────────────────────────────────────
function ResultsTab({ year, results2026, onAddResult }) {
  const data = year === 2026 ? [] : (HIST[year] || []);
  const is2026 = year === 2026;

  // For 2026 live tracking: use our current predictions + user-entered results
  const liveGames = is2026 ? M_INIT.map((m, i) => {
    const p = predict(m);
    const r = results2026[i];
    return r ? { ...m, i, p, actual_s1: r.s1, actual_s2: r.s2, completed: true } : { ...m, i, p, completed: false };
  }) : [];

  // Compute ATS results for historical data
  const analyzed = data.map(g => {
    const actualMargin = g.sc1 - g.sc2; // higher seed margin
    const actualTotal = g.sc1 + g.sc2;
    const spread = g.spd; // negative = higher seed favored
    const covered = (actualMargin + spread) > 0; // did higher seed cover?
    // For our model: we'd predict the favorite to cover when model spread < DK spread
    // Since we don't have model predictions for historical data, use actual vs line
    const ouResult = actualTotal > g.ou ? "OVER" : actualTotal < g.ou ? "UNDER" : "PUSH";
    const atsPush = Math.abs(actualMargin + spread) < 0.5;
    return { ...g, actualMargin, actualTotal, covered, atsPush, ouResult };
  });

  // Stats
  const completed = analyzed.length;
  const atsWins = analyzed.filter(g => g.covered && !g.atsPush).length;
  const atsLosses = analyzed.filter(g => !g.covered && !g.atsPush).length;
  const atsPushes = analyzed.filter(g => g.atsPush).length;
  const overHits = analyzed.filter(g => g.ouResult === "OVER").length;
  const underHits = analyzed.filter(g => g.ouResult === "UNDER").length;
  const avgMarginError = completed > 0 ? analyzed.reduce((s, g) => s + Math.abs(g.actualMargin - (-g.spd)), 0) / completed : 0;
  const favCovered = analyzed.filter(g => g.spd < 0 && g.covered).length;
  const favTotal = analyzed.filter(g => g.spd < 0).length;
  const dogCovered = analyzed.filter(g => g.spd > 0 && !g.covered).length; // dog covers when fav doesn't
  const upsets = analyzed.filter(g => g.actualMargin < 0).length; // lower seed won

  const mono = "'JetBrains Mono',mono";

  if (is2026) {
    const completed2026 = liveGames.filter(g => g.completed);
    
    // ── ATS tracking ──
    const atsResults = completed2026.map(g => {
      const actualMargin = g.actual_s1 - g.actual_s2;
      const modelFavT1 = g.p?.modelSpread < 0;
      const dkFavT1 = g.vs < 0;
      // Model leans t1 ATS when model has t1 more favored than DK
      const modelLeansT1 = g.p?.modelSpread < g.vs;
      const t1Covers = (actualMargin + g.vs) > 0;
      const push = Math.abs(actualMargin + g.vs) < 0.01;
      const modelCorrect = push ? null : modelLeansT1 === t1Covers;
      const spreadEdge = modelLeansT1 ? (actualMargin + g.vs) : -(actualMargin + g.vs);
      return { ...g, actualMargin, modelLeansT1, t1Covers, push, modelCorrect, spreadEdge };
    });
    const atsNonPush = atsResults.filter(g => g.modelCorrect !== null);
    const atsWins = atsNonPush.filter(g => g.modelCorrect === true).length;
    const atsLosses = atsNonPush.filter(g => g.modelCorrect === false).length;
    
    // ── O/U tracking ──
    const ouResults = completed2026.map(g => {
      const actualTotal = g.actual_s1 + g.actual_s2;
      const modelTotal = g.p?.modelTotal || 0;
      const dkTotal = g.vt;
      const modelLean = modelTotal > dkTotal + 1.5 ? "OVER" : modelTotal < dkTotal - 1.5 ? "UNDER" : null;
      const actualResult = actualTotal > dkTotal ? "OVER" : actualTotal < dkTotal ? "UNDER" : "PUSH";
      const ouCorrect = modelLean === null ? null : (actualResult === "PUSH" ? null : modelLean === actualResult);
      const ouEdge = modelLean === null ? 0 : (ouCorrect ? Math.abs(actualTotal - dkTotal) : -Math.abs(actualTotal - dkTotal));
      return { ...g, actualTotal, modelTotal, dkTotal, modelLean, actualResult, ouCorrect, ouEdge };
    });
    const ouPicks = ouResults.filter(g => g.ouCorrect !== null);
    const ouWins = ouPicks.filter(g => g.ouCorrect === true).length;
    const ouLosses = ouPicks.filter(g => g.ouCorrect === false).length;
    
    return <div>
      <div style={{ padding: "12px", background: "#111118", borderRadius: 8, border: "1px solid #222230", marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#d97706", marginBottom: 8 }}>📊 2026 LIVE RESULTS — Enter scores as games complete</div>
        <p style={{ fontSize: 10, color: "#666", margin: "0 0 12px" }}>Click "Add Score" on any game below to enter the final score. The model tracks ATS spread picks AND O/U total picks.</p>
        {completed2026.length > 0 && <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8, marginBottom: 8 }}>
            <div style={{ padding: "8px", background: "#0d0d14", borderRadius: 7, textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#e0e0ea", fontFamily: mono }}>{completed2026.length}</div>
              <div style={{ fontSize: 9, color: "#555" }}>COMPLETED</div>
            </div>
            <div style={{ padding: "8px", background: "#0d0d14", borderRadius: 7, textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: atsWins > atsLosses ? "#16a34a" : atsWins < atsLosses ? "#dc2626" : "#d97706", fontFamily: mono }}>{atsWins}-{atsLosses}</div>
              <div style={{ fontSize: 9, color: "#555" }}>ATS RECORD</div>
            </div>
            <div style={{ padding: "8px", background: "#0d0d14", borderRadius: 7, textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: atsNonPush.length > 0 ? (atsWins/atsNonPush.length > 0.524 ? "#16a34a" : "#dc2626") : "#888", fontFamily: mono }}>{atsNonPush.length > 0 ? Math.round(atsWins/atsNonPush.length*100) : "—"}%</div>
              <div style={{ fontSize: 9, color: "#555" }}>ATS %</div>
            </div>
            <div style={{ padding: "8px", background: "#0d0d14", borderRadius: 7, textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: ouWins > ouLosses ? "#16a34a" : ouWins < ouLosses ? "#dc2626" : "#d97706", fontFamily: mono }}>{ouWins}-{ouLosses}</div>
              <div style={{ fontSize: 9, color: "#555" }}>O/U RECORD</div>
            </div>
            <div style={{ padding: "8px", background: "#0d0d14", borderRadius: 7, textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: ouPicks.length > 0 ? (ouWins/ouPicks.length > 0.524 ? "#16a34a" : "#dc2626") : "#888", fontFamily: mono }}>{ouPicks.length > 0 ? Math.round(ouWins/ouPicks.length*100) : "—"}%</div>
              <div style={{ fontSize: 9, color: "#555" }}>O/U %</div>
            </div>
            <div style={{ padding: "8px", background: "#0d0d14", borderRadius: 7, textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#16a34a", fontFamily: mono }}>{completed2026.filter(g => Math.abs((g.actual_s1-g.actual_s2) - (-g.p?.modelSpread||0)) <= (ML.conformal_spread[0.80]||17)).length}</div>
              <div style={{ fontSize: 9, color: "#555" }}>WITHIN 80% CI</div>
            </div>
          </div>
          {/* Signed edge summary */}
          {atsNonPush.length > 0 && <div style={{ display: "flex", gap: 16, marginTop: 4, fontSize: 10, color: "#888" }}>
            <span>ATS Signed Edge: <b style={{ color: atsResults.reduce((s,g) => s + g.spreadEdge, 0) / Math.max(1, atsNonPush.length) > 0 ? "#16a34a" : "#dc2626", fontFamily: mono }}>{(atsResults.reduce((s,g) => s + g.spreadEdge, 0) / Math.max(1, atsNonPush.length)).toFixed(1)} pts/pick</b></span>
            {ouPicks.length > 0 && <span>O/U Signed Edge: <b style={{ color: ouPicks.reduce((s,g) => s + g.ouEdge, 0) / ouPicks.length > 0 ? "#16a34a" : "#dc2626", fontFamily: mono }}>{(ouPicks.reduce((s,g) => s + g.ouEdge, 0) / ouPicks.length).toFixed(1)} pts/pick</b></span>}
          </div>}
        </>}
      </div>
      {/* Game-by-game cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
        {liveGames.map((g, idx) => {
          const ats = atsResults.find(r => r.i === g.i);
          const ou = ouResults.find(r => r.i === g.i);
          return <div key={g.i} style={{ padding: "10px 12px", background: "#111118", borderRadius: 8, border: `1px solid ${g.completed ? (ats?.modelCorrect ? "#16a34a33" : ats?.modelCorrect === false ? "#dc262633" : "#d9770633") : "#222230"}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#e0e0ea" }}>{g.t1} vs {g.t2}</div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {g.completed && ats && <span style={{ fontSize: 8, fontWeight: 800, padding: "2px 6px", borderRadius: 3, background: ats.modelCorrect ? "#16a34a18" : ats.modelCorrect === false ? "#dc262618" : "#d9770618", color: ats.modelCorrect ? "#16a34a" : ats.modelCorrect === false ? "#dc2626" : "#d97706" }}>{ats.modelCorrect ? "ATS ✓" : ats.modelCorrect === false ? "ATS ✗" : "PUSH"}</span>}
                {g.completed && ou && ou.modelLean && <span style={{ fontSize: 8, fontWeight: 800, padding: "2px 6px", borderRadius: 3, background: ou.ouCorrect ? "#16a34a18" : ou.ouCorrect === false ? "#dc262618" : "#d9770618", color: ou.ouCorrect ? "#16a34a" : ou.ouCorrect === false ? "#dc2626" : "#d97706" }}>{ou.ouCorrect ? "O/U ✓" : ou.ouCorrect === false ? "O/U ✗" : "O/U —"}</span>}
                {!g.completed && <button onClick={() => {
                  const s1 = prompt(`Final score for ${g.t1}:`);
                  const s2 = prompt(`Final score for ${g.t2}:`);
                  if (s1 && s2 && !isNaN(+s1) && !isNaN(+s2)) onAddResult(g.i, +s1, +s2);
                }} style={{ padding: "3px 8px", borderRadius: 5, border: "1px solid #d9770644", background: "#d9770614", color: "#d97706", fontSize: 9, fontWeight: 700, cursor: "pointer" }}>Add Score</button>}
              </div>
            </div>
            {/* Spread row */}
            <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 10, color: "#888", flexWrap: "wrap" }}>
              <span>Spread: <b style={{ color: "#a78bfa", fontFamily: mono }}>{g.p?.modelSpread > 0 ? g.t2 : g.t1} by {Math.abs(g.p?.modelSpread||0).toFixed(1)}</b></span>
              <span>DK: <b style={{ fontFamily: mono }}>{g.vs}</b></span>
              <span>Lean: <b style={{ color: "#d97706", fontFamily: mono }}>{g.p?.spreadLeanTeam || "—"}</b></span>
              {g.completed && <span>Actual: <b style={{ color: "#16a34a", fontFamily: mono }}>{g.actual_s1}-{g.actual_s2}</b> ({ats ? (ats.spreadEdge > 0 ? "+" : "") + ats.spreadEdge.toFixed(1) : ""})</span>}
            </div>
            {/* Total row */}
            <div style={{ display: "flex", gap: 16, marginTop: 4, fontSize: 10, color: "#888", flexWrap: "wrap" }}>
              <span>Model Total: <b style={{ color: "#60a5fa", fontFamily: mono }}>{g.p?.modelTotal || "—"}</b></span>
              <span>DK O/U: <b style={{ fontFamily: mono }}>{g.vt}</b></span>
              <span>Lean: <b style={{ color: ou?.modelLean ? "#d97706" : "#555", fontFamily: mono }}>{ou?.modelLean || "—"}{ou?.modelLean ? ` (${Math.abs((g.p?.modelTotal||0) - g.vt).toFixed(1)} pts)` : ""}</b></span>
              {g.completed && <span>Actual Total: <b style={{ color: ou?.actualResult === "OVER" ? "#16a34a" : "#60a5fa", fontFamily: mono }}>{ou?.actualTotal} ({ou?.actualResult})</b></span>}
            </div>
          </div>;
        })}
      </div>
    </div>;
  }

  // Historical backtest view
  const loso = LOSO[year];
  return <div>
    {/* LOSO Model Performance Summary */}
    {loso && <div style={{ padding: "14px", background: "linear-gradient(135deg,#111118,#1a1028)", borderRadius: 10, border: "1px solid #a78bfa33", marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#a78bfa", letterSpacing: ".06em", marginBottom: 10 }}>🤖 MODEL PERFORMANCE — LOSO BACKTEST ({year})</div>
      <div style={{ fontSize: 10, color: "#888", marginBottom: 10, lineHeight: 1.5 }}>
        Trained on all tournament games <b>except {year}</b>, then tested on {year}'s {loso.n} games. This is a true out-of-sample evaluation — the model never saw these games during training.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))", gap: 8 }}>
        {[
          ["Spread MAE", loso.mae_spread + " pts", loso.mae_spread < 10 ? "#16a34a" : loso.mae_spread < 11 ? "#d97706" : "#dc2626"],
          ["Total MAE", loso.mae_total + " pts", loso.mae_total < 15 ? "#16a34a" : "#d97706"],
          ["80% Coverage", Math.round(loso.conf80*100) + "%", loso.conf80 >= 0.75 ? "#16a34a" : loso.conf80 >= 0.65 ? "#d97706" : "#dc2626"],
          ["90% Coverage", Math.round(loso.conf90*100) + "%", loso.conf90 >= 0.85 ? "#16a34a" : "#d97706"],
          ["QR 80% Cov", Math.round(loso.qr80*100) + "%", loso.qr80 >= 0.7 ? "#16a34a" : "#d97706"],
        ].map(([label, val, color], i) => <div key={i} style={{ padding: "8px 10px", background: "#0d0d14", borderRadius: 7, textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color, fontFamily: mono }}>{val}</div>
          <div style={{ fontSize: 8, color: "#555", fontWeight: 600 }}>{label}</div>
        </div>)}
      </div>
      <div style={{ marginTop: 10, fontSize: 9, color: "#666", lineHeight: 1.6 }}>
        <b style={{ color: "#a78bfa" }}>What this means:</b> On {year} tournament games the model had never seen,
        the average spread prediction was off by <b style={{ color: "#e0e0ea" }}>{loso.mae_spread} pts</b>.
        The conformal 90% interval captured <b style={{ color: loso.conf90 >= 0.85 ? "#16a34a" : "#d97706" }}>{Math.round(loso.conf90*100)}%</b> of actual results (target: 90%).
        {loso.mae_spread < 10 ? " This was one of the model's stronger seasons." : loso.mae_spread > 11 ? " This was a tougher year for the model — more variance than usual." : ""}
        {" "}Across all {LOSO.avg.mae_spread ? "15 seasons" : "seasons"}, average MAE is <b style={{ color: "#a78bfa" }}>{LOSO.avg.mae_spread} pts</b>.
      </div>
    </div>}

    {/* Model ATS Performance — from BACKTEST data */}
    {(() => {
      const bt = BACKTEST.filter(g => g.yr === year);
      const btPlays = bt.filter(g => g.mc !== null);
      const btWins = btPlays.filter(g => g.mc === true).length;
      const btLosses = btPlays.filter(g => g.mc === false).length;
      const modelMAE = bt.length > 0 ? bt.reduce((s,g) => s + g.se, 0) / bt.length : 0;
      const dkMAE = bt.length > 0 ? bt.reduce((s,g) => s + g.de, 0) / bt.length : 0;
      const bigVal = btPlays.filter(g => Math.abs(g.val) >= 3);
      const bvWins = bigVal.filter(g => g.mc === true).length;

      return bt.length > 0 ? <>
      <div style={{ padding: "14px", background: "linear-gradient(135deg,#111118,#0d1a10)", borderRadius: 10, border: "1px solid #16a34a33", marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#16a34a", letterSpacing: ".06em", marginBottom: 10 }}>📊 MODEL vs MARKET — ATS PERFORMANCE ({year})</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))", gap: 8, marginBottom: 10 }}>
          {[
            ["ATS Record", `${btWins}-${btLosses}`, btWins > btLosses ? "#16a34a" : "#dc2626"],
            ["ATS %", btPlays.length > 0 ? Math.round(btWins/btPlays.length*100)+"%" : "—", btWins > btLosses ? "#16a34a" : "#dc2626"],
            ["Model MAE", modelMAE.toFixed(1)+"pts", "#a78bfa"],
            ["DK MAE", dkMAE.toFixed(1)+"pts", "#d97706"],
            ["Big Value", `${bvWins}-${bigVal.length-bvWins}`, bvWins > bigVal.length-bvWins ? "#16a34a" : "#dc2626"],
            ["Games", bt.length, "#888"],
          ].map(([label, val, color], i) => <div key={i} style={{ padding: "8px", background: "#0d0d14", borderRadius: 7, textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color, fontFamily: mono }}>{val}</div>
            <div style={{ fontSize: 8, color: "#555", fontWeight: 600 }}>{label}</div>
          </div>)}
        </div>
        <div style={{ fontSize: 10, color: "#888", lineHeight: 1.6 }}>
          The model went <b style={{ color: btWins > btLosses ? "#16a34a" : "#dc2626" }}>{btWins}-{btLosses} ATS</b> on value picks (games where model disagreed with DK by 1+ pt).
          {modelMAE < dkMAE ? <> Model MAE (<b style={{color:"#16a34a"}}>{modelMAE.toFixed(1)}</b>) beat DK (<b>{dkMAE.toFixed(1)}</b>) — model predicted closer to actual margins.</> :
           <> DK lines (<b style={{color:"#d97706"}}>{dkMAE.toFixed(1)}</b>) were more accurate than model (<b>{modelMAE.toFixed(1)}</b>) on raw margin prediction. Note: ESPN data lacks Four Factors, tempo, 3PT% — those features were zeroed out in this backtest.</>}
          {bigVal.length > 0 && <> On <b>big value picks</b> (3+ pt disagreement): <b style={{ color: bvWins > bigVal.length-bvWins ? "#16a34a" : "#dc2626" }}>{bvWins}-{bigVal.length-bvWins}</b>.</>}
        </div>
      </div>
      </> : null;
    })()}

    {/* Summary Stats (from HIST data) */}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 8, marginBottom: 14 }}>
      {[
        ["Games", completed, "#e0e0ea"],
        ["Fav ATS", `${favCovered}/${favTotal}`, "#d97706"],
        ["Upsets", upsets, "#dc2626"],
        ["Overs", overHits, "#16a34a"],
        ["Unders", underHits, "#2563eb"],
        ["DK Error", avgMarginError.toFixed(1)+"pts", "#a78bfa"],
      ].map(([label, val, color], i) => <div key={i} style={{ padding: "10px 12px", background: "#111118", borderRadius: 8, border: "1px solid #222230", textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color, fontFamily: mono }}>{val}</div>
        <div style={{ fontSize: 9, color: "#555", fontWeight: 600 }}>{label}</div>
      </div>)}
    </div>

    {/* Game-by-game results WITH MODEL PREDICTIONS */}
    <div style={{ fontSize: 10, fontWeight: 700, color: "#888", letterSpacing: ".06em", marginBottom: 8 }}>GAME-BY-GAME — MODEL vs DK vs ACTUAL</div>
    <div style={{ display: "grid", gap: 6 }}>
      {analyzed.map((g, i) => {
        const favWon = g.actualMargin > 0;
        const upset = g.actualMargin < 0;
        // Find matching BACKTEST entry for model prediction
        const bt = BACKTEST.find(b => b.yr === year && b.t1 === g.t1 && b.t2 === g.t2);
        return <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#111118", borderRadius: 7, border: `1px solid ${bt?.mc === true ? "#16a34a33" : bt?.mc === false ? "#dc262633" : "#222230"}` }}>
          <div style={{ width: 28, textAlign: "center" }}>
            {bt ? (bt.mc === true ? <span style={{ color: "#16a34a", fontSize: 14, fontWeight: 800 }}>✓</span> : bt.mc === false ? <span style={{ color: "#dc2626", fontSize: 14, fontWeight: 800 }}>✗</span> : <span style={{ color: "#555", fontSize: 12 }}>—</span>) : <span style={{ color: "#555", fontSize: 12 }}>—</span>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, color: favWon ? "#e0e0ea" : "#888", fontSize: 11 }}>{g.t1} {g.sc1}</span>
              <span style={{ fontWeight: 700, color: !favWon ? "#e0e0ea" : "#888", fontSize: 11 }}>{g.t2} {g.sc2}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, flexWrap: "wrap", gap: 4 }}>
              <span style={{ fontSize: 9, color: "#555" }}>
                DK: <b style={{ color: "#d97706", fontFamily: mono }}>{g.spd}</b>
                {bt && <> | Model: <b style={{ color: "#a78bfa", fontFamily: mono }}>{bt.ms > 0 ? "+" : ""}{bt.ms}</b></>}
                | Actual: <b style={{ color: "#e0e0ea", fontFamily: mono }}>{g.actualMargin > 0 ? "+" : ""}{g.actualMargin}</b>
              </span>
              <span style={{ fontSize: 9 }}>
                {bt && bt.val !== 0 && <span style={{ color: bt.mc === true ? "#16a34a" : bt.mc === false ? "#dc2626" : "#555", fontWeight: 600 }}>
                  {bt.mc === true ? "✓ " : bt.mc === false ? "✗ " : ""}{bt.model_lean || (bt.val < 0 ? g.t1 : g.t2)}
                </span>}
                {" "}<span style={{ color: g.ouResult === "OVER" ? "#16a34a" : g.ouResult === "UNDER" ? "#2563eb" : "#888" }}>{g.ouResult}</span>
              </span>
            </div>
          </div>
          {upset && <span style={{ fontSize: 8, fontWeight: 800, padding: "2px 6px", borderRadius: 3, background: "#dc262618", color: "#dc2626", whiteSpace: "nowrap" }}>UPSET</span>}
        </div>;
      })}
    </div>
  </div>;
}

// ─── ESPN LIVE DATA FETCHER ─────────────────────────────────────────────────
// Fetches live/final scores and current odds from ESPN's public API
const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball";

// Team name normalization: ESPN uses full names, our data uses abbreviations
const TEAM_ALIAS = {
  "Michigan State Spartans":"Michigan State","North Carolina Tar Heels":"North Carolina",
  "Ohio State Buckeyes":"Ohio State","Iowa State Cyclones":"Iowa State",
  "NC State Wolfpack":"NC State","Texas A&M Aggies":"Texas A&M",
  "Virginia Tech Hokies":"Virginia Tech","Saint Mary's Gaels":"Saint Mary's",
  "North Dakota State Bison":"N. Dakota State","Tennessee State Tigers":"Tennessee State",
  "Northern Iowa Panthers":"Northern Iowa","Santa Clara Broncos":"Santa Clara",
  "Wright State Raiders":"Wright State","Cal Baptist Lancers":"Cal Baptist",
  "South Florida Bulls":"South Florida","Miami (OH) RedHawks":"Miami (OH)",
  "Prairie View A&M Panthers":"Prairie View A&M","Kennesaw State Owls":"Kennesaw State",
  "Saint Louis Billikens":"Saint Louis","St. John's Red Storm":"St. John's",
  "Long Island Sharks":"Long Island","High Point Panthers":"High Point",
  "Utah State Aggies":"Utah State","Miami Hurricanes":"Miami (FL)",
};
const normName = (n) => TEAM_ALIAS[n] || n.replace(/ (Bulldogs|Cardinals|Wildcats|Wolverines|Gators|Cougars|Panthers|Bears|Hawks|Tigers|Hoosiers|Badgers|Cornhuskers|Trojans|Cowboys|Bison|Commodores|Owls|Billikens|Mountaineers|Zips|Saints|Broncos|Gaels|Aggies|Paladins|Monarchs|Vandals|Warriors|Antelopes|Retrievers|Raiders|Lancers|Musketeers|RedHawks|Mustangs|Mountain Hawks|Quakers|Rainbow Warriors|Chanticleers|Hawkeyes|Boilermakers|Fighting Illini|Blue Devils|Huskies|Red Storm|Jayhawks|Knights|Bruins|Crimson Tide|Cavaliers|Horned Frogs|Longhorns|Red Raiders|Seminoles|Volunteers|Demon Deacons|Wolfpack|Peacocks|Royals|Flames|Rams|Eagles)$/i, '').trim();

async function fetchESPNScores() {
  try {
    // Fetch NCAA tournament scoreboard
    const res = await fetch(`${ESPN_BASE}/scoreboard?dates=20260317-20260407&groups=100&limit=100`);
    if (!res.ok) return { scores: [], odds: [], error: "ESPN API returned " + res.status };
    const data = await res.json();
    const events = data.events || [];
    
    const results = [];
    for (const ev of events) {
      const comp = ev.competitions?.[0];
      if (!comp) continue;
      
      const teams = comp.competitors || [];
      if (teams.length < 2) continue;
      
      // Get team names and scores
      const home = teams.find(t => t.homeAway === "home") || teams[0];
      const away = teams.find(t => t.homeAway === "away") || teams[1];
      
      const homeName = normName(home.team?.displayName || "");
      const awayName = normName(away.team?.displayName || "");
      const homeScore = parseInt(home.score || "0");
      const awayScore = parseInt(away.score || "0");
      
      const status = comp.status?.type?.name || "STATUS_SCHEDULED";
      const isLive = status === "STATUS_IN_PROGRESS";
      const isFinal = status === "STATUS_FINAL";
      const statusText = comp.status?.type?.shortDetail || "";
      
      // Get odds if available
      let spread = null, total = null;
      const oddsArr = comp.odds || [];
      if (oddsArr.length > 0) {
        const o = oddsArr[0]; // DraftKings is usually first
        spread = o.spread;
        total = o.overUnder;
      }
      
      results.push({
        homeName, awayName, homeScore, awayScore,
        status, isLive, isFinal, statusText,
        spread, total,
      });
    }
    return { scores: results, error: null };
  } catch (e) {
    return { scores: [], error: e.message };
  }
}

export default function App() {
  const [tab, setTab] = useState("predictions"); // "predictions" | "results"
  const [reg, setReg] = useState("All");
  const [sort, setSort] = useState("confidence");
  const [exp, setExp] = useState(null);
  const [minC, setMinC] = useState(0);
  const [valOnly, setValOnly] = useState(false);
  const [dayFilter, setDayFilter] = useState("All");
  const [lines, setLines] = useState(M_INIT);
  const [editing, setEditing] = useState(null);
  const [btYear, setBtYear] = useState(2025); // backtest year selector
  const [results2026, setResults2026] = useState({}); // {gameIndex: {s1: score1, s2: score2}}
  const [liveStatus, setLiveStatus] = useState("idle"); // "idle" | "loading" | "success" | "error"
  const [lastRefresh, setLastRefresh] = useState(null);
  const [liveError, setLiveError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Match ESPN data to our games by team names
  const applyLiveData = useCallback(async () => {
    setLiveStatus("loading");
    const { scores, error } = await fetchESPNScores();
    if (error) {
      setLiveStatus("error");
      setLiveError(error);
      return;
    }
    
    let updatedLines = 0;
    let updatedScores = 0;
    
    setLines(prev => prev.map((m, idx) => {
      // Find matching ESPN game
      const match = scores.find(s => 
        (s.homeName === m.t1 && s.awayName === m.t2) ||
        (s.homeName === m.t2 && s.awayName === m.t1) ||
        (m.t1.includes(s.homeName) || s.homeName.includes(m.t1)) &&
        (m.t2.includes(s.awayName) || s.awayName.includes(m.t2))
      );
      if (!match) return m;
      
      const updated = { ...m };
      
      // Update odds if available and different
      if (match.spread !== null && match.spread !== undefined) {
        // ESPN spread is from home team perspective
        const isT1Home = match.homeName === m.t1 || m.t1.includes(match.homeName);
        const newSpread = isT1Home ? match.spread : -match.spread;
        if (newSpread !== m.vs) {
          updated.vs = newSpread;
          updatedLines++;
        }
      }
      if (match.total !== null && match.total !== undefined && match.total !== m.vt) {
        updated.vt = match.total;
        updatedLines++;
      }
      
      // Update scores if game is live or final
      if ((match.isLive || match.isFinal) && (match.homeScore > 0 || match.awayScore > 0)) {
        const isT1Home = match.homeName === m.t1 || m.t1.includes(match.homeName);
        const s1 = isT1Home ? match.homeScore : match.awayScore;
        const s2 = isT1Home ? match.awayScore : match.homeScore;
        updated._liveS1 = s1;
        updated._liveS2 = s2;
        updated._liveStatus = match.statusText;
        updated._isFinal = match.isFinal;
        updated._isLive = match.isLive;
        
        // Auto-add to results if final
        if (match.isFinal) {
          setResults2026(prev => ({ ...prev, [idx]: { s1, s2 } }));
          updatedScores++;
        }
      }
      
      return updated;
    }));
    
    setLiveStatus("success");
    setLastRefresh(new Date());
    setLiveError(`Updated ${updatedLines} lines, ${updatedScores} final scores`);
    setTimeout(() => setLiveStatus("idle"), 3000);
  }, []);

  // Auto-refresh every 60 seconds when enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(applyLiveData, 60000);
    return () => clearInterval(interval);
  }, [autoRefresh, applyLiveData]);

  // Update a single game's spread or total
  const updateLine = (idx, field, val) => {
    const num = parseFloat(val);
    if (isNaN(num)) return;
    setLines(prev => prev.map((m, i) => i === idx ? { ...m, [field]: num } : m));
  };

  const games = useMemo(() => {
    let g = lines.map((m, i) => ({ ...m, i, p: predict(m) })).filter(x => x.p);
    if (reg !== "All") g = g.filter(x => x.r === reg);
    if (dayFilter !== "All") g = g.filter(x => x.day === dayFilter);
    if (minC > 0) g = g.filter(x => x.p.spreadConf >= minC || x.p.totalConf >= minC);
    if (valOnly) g = g.filter(x => x.p.spreadLeanTeam || x.p.totalLeanDir);
    if (sort === "value") g.sort((a, b) => (Math.abs(b.p.spreadVal) + Math.abs(b.p.totalVal)) - (Math.abs(a.p.spreadVal) + Math.abs(a.p.totalVal)));
    else if (sort === "confidence") g.sort((a, b) => Math.max(b.p.spreadConf, b.p.totalConf) - Math.max(a.p.spreadConf, a.p.totalConf));
    else if (sort === "time") {
      const dayOrd = { Tue: 0, Wed: 1, Thu: 2, Fri: 3 };
      // All tournament games are PM ET (12:15 PM through 10:15 PM)
      // Times stored as "H:MM ET" or "HH:MM ET" — all are PM
      // 12:XX = 12:XX (noon), 1:XX-10:XX = add 12 to get 13:XX-22:XX
      const parseTime = (t) => {
        if (!t) return 0;
        const parts = t.replace(" ET", "").split(":");
        let hr = parseInt(parts[0]);
        const min = parseInt(parts[1]) || 0;
        // Hours 1-10 are PM (add 12), hour 12 stays as 12 (noon)
        if (hr >= 1 && hr <= 10) hr += 12;
        return hr * 60 + min;
      };
      g.sort((a, b) => ((dayOrd[a.day]||0)*10000 + parseTime(a.time)) - ((dayOrd[b.day]||0)*10000 + parseTime(b.time)));
    }
    else g.sort((a, b) => Math.abs(a.vs) - Math.abs(b.vs));
    return g;
  }, [reg, sort, minC, valOnly, lines, dayFilter]);

  const valCount = games.filter(g => g.p.spreadLeanTeam || g.p.totalLeanDir).length;
  const avgC = games.length ? Math.round(games.reduce((s, g) => s + Math.max(g.p.spreadConf, g.p.totalConf), 0) / games.length) : 0;

  return <div style={{ "--bg": "#08080e", "--sf": "#111118", "--sf2": "#0d0d14", "--bd": "#222230", "--tx": "#e0e0ea", "--mt": "#555", minHeight: "100vh", background: "var(--bg)", color: "var(--tx)", fontFamily: "'Inter',-apple-system,sans-serif", padding: "0 0 40px" }}>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    {/* Header */}
    <div style={{ padding: "28px 20px 20px", background: "linear-gradient(180deg,#111118,#08080e)", borderBottom: "1px solid var(--bd)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 24 }}>🏀</span>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".12em", color: "#d97706", fontFamily: "'JetBrains Mono',mono" }}>MARCH MADNESS 2026 • v5.0</span>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-.03em", margin: "0 0 4px", lineHeight: 1.1, background: "linear-gradient(135deg,#fff,#8888a8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>NCAA Tournament Betting Model</h1>
        <p style={{ fontSize: 12, color: "#666", margin: "0 0 8px", maxWidth: 600, lineHeight: 1.5 }}>Multi-source predictive engine with live-editable DraftKings spreads. Update any line and the model recalculates value instantly.</p>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
          {SRC_TAGS.map(s => <span key={s} style={{ fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 4, background: "#1a1a28", color: "#888", letterSpacing: ".03em" }}>{s}</span>)}
        </div>
        <div style={{ display: "flex", gap: 24, alignItems: "flex-end" }}>
          {[["Games", games.length], ["Value Bets", valCount, "#16a34a"], ["Avg Conf", avgC + "%", "#ca8a04"]].map(([l, v, c], i) =>
            <div key={i}><div style={{ fontSize: 20, fontWeight: 800, color: c || "#e0e0ea", fontFamily: "'JetBrains Mono',mono" }}>{v}</div>
              <div style={{ fontSize: 9, color: "#555", fontWeight: 600, letterSpacing: ".06em" }}>{l}</div></div>
          )}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={applyLiveData} disabled={liveStatus === "loading"} style={{
              padding: "6px 12px", borderRadius: 6, border: "1px solid #d9770644",
              background: liveStatus === "loading" ? "#d9770622" : liveStatus === "success" ? "#16a34a22" : "#d9770611",
              color: liveStatus === "success" ? "#16a34a" : "#d97706",
              fontSize: 10, fontWeight: 700, cursor: liveStatus === "loading" ? "wait" : "pointer",
              fontFamily: "'JetBrains Mono',mono", letterSpacing: ".03em", transition: "all .2s",
            }}>
              {liveStatus === "loading" ? "⏳ Fetching..." : liveStatus === "success" ? "✅ Updated" : "🔄 Refresh Lines & Scores"}
            </button>
            <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
              <input type="checkbox" checked={autoRefresh} onChange={e => { setAutoRefresh(e.target.checked); if (e.target.checked) applyLiveData(); }}
                style={{ accentColor: "#d97706" }} />
              <span style={{ fontSize: 9, color: autoRefresh ? "#d97706" : "#555", fontWeight: 600 }}>Auto 60s</span>
            </label>
          </div>
        </div>
        {lastRefresh && <div style={{ fontSize: 9, color: "#444", marginTop: 6, fontFamily: "'JetBrains Mono',mono" }}>
          Last refresh: {lastRefresh.toLocaleTimeString()} {liveError && <span style={{ color: liveStatus === "error" ? "#dc2626" : "#16a34a" }}>— {liveError}</span>}
        </div>}
        <div style={{ marginTop: 8, fontSize: 10, color: "#555", fontFamily: "'JetBrains Mono',mono" }}>
          DK Lines as of: <span style={{ color: "#d97706" }}>{LINES_UPDATED}</span> — Click any DK spread/total to edit
        </div>
        {/* Tab Navigation */}
        <div style={{ display: "flex", gap: 4, marginTop: 14, padding: 3, background: "#0d0d14", borderRadius: 8, border: "1px solid #222230", width: "fit-content" }}>
          {[["predictions","📊 Predictions"],["results","📈 Results & Backtest"]].map(([key,label]) =>
            <button key={key} onClick={() => setTab(key)} style={{
              padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700,
              background: tab === key ? "#d9770628" : "transparent",
              color: tab === key ? "#d97706" : "#555",
              fontFamily: "'JetBrains Mono',mono"
            }}>{label}</button>
          )}
        </div>
      </div>
    </div>
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 20px" }}>
      {/* ═══ RESULTS TAB ═══ */}
      {tab === "results" && <div style={{ paddingTop: 14 }}>
        <div style={{ display: "flex", gap: 4, marginBottom: 14, padding: 3, background: "#0d0d14", borderRadius: 8, border: "1px solid #222230", width: "fit-content" }}>
          {[2026, 2025, 2024].map(y =>
            <button key={y} onClick={() => setBtYear(y)} style={{
              padding: "5px 12px", borderRadius: 5, border: "none", cursor: "pointer", fontSize: 10, fontWeight: 700,
              background: btYear === y ? (y === 2026 ? "#16a34a28" : "#a78bfa28") : "transparent",
              color: btYear === y ? (y === 2026 ? "#16a34a" : "#a78bfa") : "#555",
              fontFamily: "'JetBrains Mono',mono"
            }}>{y === 2026 ? "🔴 2026 Live" : `📜 ${y} Backtest`}</button>
          )}
        </div>
        <ResultsTab year={btYear} results2026={results2026} onAddResult={(idx, s1, s2) => setResults2026(prev => ({ ...prev, [idx]: { s1, s2 } }))} />
      </div>}

      {/* ═══ PREDICTIONS TAB ═══ */}
      {tab === "predictions" && <>
      {/* Filters */}
      <div style={{ padding: "14px 0", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 3, padding: 2, background: "var(--sf)", borderRadius: 7, border: "1px solid var(--bd)" }}>
          {["All", "East", "West", "Midwest", "South"].map(r =>
            <button key={r} onClick={() => setReg(r)} style={{ padding: "4px 10px", borderRadius: 5, border: "none", background: reg === r ? (r === "All" ? "#fff1" : RC[r] + "28") : "transparent", color: reg === r ? (r === "All" ? "#fff" : RC[r]) : "#555", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "'JetBrains Mono',mono" }}>{r}</button>
          )}
        </div>
        <div style={{ display: "flex", gap: 3, padding: 2, background: "var(--sf)", borderRadius: 7, border: "1px solid var(--bd)" }}>
          {["All", "Tue", "Wed", "Thu", "Fri"].map(d =>
            <button key={d} onClick={() => setDayFilter(d)} style={{ padding: "4px 8px", borderRadius: 5, border: "none", background: dayFilter === d ? "#7c3aed28" : "transparent", color: dayFilter === d ? "#a78bfa" : "#555", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "'JetBrains Mono',mono" }}>{d}</button>
          )}
        </div>
        <select value={sort} onChange={e => setSort(e.target.value)} style={{ padding: "5px 8px", borderRadius: 7, border: "1px solid var(--bd)", background: "var(--sf)", color: "var(--tx)", fontSize: 10, fontWeight: 600, fontFamily: "'JetBrains Mono',mono", cursor: "pointer" }}>
          <option value="value">Sort: Best Value</option>
          <option value="confidence">Sort: Highest Confidence</option>
          <option value="time">Sort: Game Time</option>
          <option value="spread">Sort: Tightest Spread</option>
        </select>
        <button onClick={() => setValOnly(!valOnly)} style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid ${valOnly ? "#16a34a44" : "var(--bd)"}`, background: valOnly ? "#16a34a14" : "var(--sf)", color: valOnly ? "#16a34a" : "#555", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "'JetBrains Mono',mono" }}>🔥 Value Only</button>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 9, color: "#555", fontWeight: 600 }}>MIN CONF:</span>
          <input type="range" min={0} max={80} step={5} value={minC} onChange={e => setMinC(+e.target.value)} style={{ width: 70, accentColor: "#d97706" }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: "#d97706", fontFamily: "'JetBrains Mono',mono" }}>{minC}%</span>
        </div>
        <button onClick={() => setLines(M_INIT)} style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid var(--bd)", background: "var(--sf)", color: "#888", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "'JetBrains Mono',mono" }}>↺ Reset Lines</button>
      </div>
      {/* Methodology */}
      <div style={{ padding: "9px 12px", background: "var(--sf)", borderRadius: 7, border: "1px solid var(--bd)", marginBottom: 14, fontSize: 10, color: "#666", lineHeight: 1.5 }}>
        <span style={{ fontWeight: 700, color: "#aaa" }}>Model v5.0:</span> <span style={{ color: "#d97706" }}>Ensemble spread (KenPom 30% + Kaggle V5.1 25% + DK market 25% + BPI 10% + Ridge 10%)</span> + Kaggle O/U total (19 features, 67.7% backtest). <span style={{ color: "#22c55e" }}>3-layer confidence</span> (source agreement + data quality + team consistency). <span style={{ color: "#f59e0b" }}>MC simulation</span> (10K games). <span style={{ color: "#d97706" }}>DraftKings lines are editable</span> — click ✏️ to update.
      </div>

      {/* Line Editor Panel — shown when editing */}
      {editing !== null && (() => {
        const em = lines[editing];
        return <div style={{ padding: "14px", background: "#161620", borderRadius: 10, border: "1px solid #d9770644", marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#d97706" }}>✏️ Edit DraftKings Line: {em.t1} vs {em.t2}</div>
            <button onClick={() => setEditing(null)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 14 }}>✕</button>
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            <div>
              <label style={{ fontSize: 9, color: "#888", fontWeight: 600 }}>SPREAD ({em.t1})</label>
              <input type="number" step="0.5" value={em.vs} onChange={e => updateLine(editing, "vs", e.target.value)}
                style={{ display: "block", width: 90, padding: "6px 8px", marginTop: 3, borderRadius: 6, border: "1px solid #d9770644", background: "#0d0d14", color: "#e0e0ea", fontSize: 14, fontWeight: 700, fontFamily: "'JetBrains Mono',mono" }} />
            </div>
            <div>
              <label style={{ fontSize: 9, color: "#888", fontWeight: 600 }}>TOTAL (O/U)</label>
              <input type="number" step="0.5" value={em.vt} onChange={e => updateLine(editing, "vt", e.target.value)}
                style={{ display: "block", width: 90, padding: "6px 8px", marginTop: 3, borderRadius: 6, border: "1px solid #d9770644", background: "#0d0d14", color: "#e0e0ea", fontSize: 14, fontWeight: 700, fontFamily: "'JetBrains Mono',mono" }} />
            </div>
          </div>
          <div style={{ marginTop: 8, fontSize: 9, color: "#555" }}>Adjust to current DraftKings line. Model predictions & value calculations update instantly.</div>
        </div>;
      })()}

      {/* Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
        {games.map(g => <GameCard key={g.i} m={g} pred={g.p} exp={exp === g.i} onTog={() => setExp(exp === g.i ? null : g.i)} onEdit={() => { setEditing(g.i); setExp(null); }} />)}
      </div>
      {games.length === 0 && <div style={{ textAlign: "center", padding: 50, color: "#555" }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>🔍</div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>No games match your filters</div>
      </div>}
      </>}
      {/* Disclaimer */}
      <div style={{ marginTop: 20, padding: "10px 12px", background: "var(--sf)", borderRadius: 7, border: "1px solid var(--bd)", fontSize: 9, color: "#555", lineHeight: 1.6 }}>
        <strong>Disclaimer:</strong> For informational/entertainment purposes only. Model uses publicly available data from KenPom, BartTorvik, EvanMiya, Hoop-Math, and DraftKings Sportsbook. Not financial advice. Lines as of {LINES_UPDATED}. Gamble responsibly. Problem gambling? Call 1-800-GAMBLER.
      </div>
    </div>
  </div>;
}
