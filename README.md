# 🏀 March Madness 2026 — Predictive Betting Model v4.0

ML-powered sports betting model for the 2026 NCAA Tournament. Features Ridge regression trained on 1,001 historical tournament games, Monte Carlo simulations, ensemble consensus, and real ESPN deep features for 66/68 teams.

![Model Version](https://img.shields.io/badge/model-v4.0-orange)
![Games](https://img.shields.io/badge/games-36-blue)
![ML](https://img.shields.io/badge/ML-Ridge%20%2B%20Monte%20Carlo-purple)

## Features

- **Ridge ML Model** — Trained on 1,001 NCAA tournament games (2010–2025), 30 deep features, LOSO MAE 9.84 pts
- **Monte Carlo Simulation** — 10,000 game simulations per matchup for win/cover/over-under probabilities
- **Ensemble Consensus** — Cross-references Model + KenPom + ESPN BPI + MC simulations
- **Line Movement Tracking** — Opening vs current spreads with sharp money indicators
- **Upset Alerts** — Deep-feature backed upset detection (trajectory, away EM, volatility)
- **Edge-Based Confidence** — Recalibrated from 2024-2025 backtest (toss-up specialist weighting)
- **Results & Backtest** — 64 historical games with real model ATS predictions + live 2026 score tracking
- **Editable DK Lines** — Click ✏️ to update any spread or total in real-time

## Data Sources

| Source | Data |
|--------|------|
| KenPom | AdjEM, AdjO/D, AdjTempo, Four Factors |
| BartTorvik | Last-30-day efficiency delta |
| EvanMiya | Injury-adjusted impact, BPR player ratings |
| Hoop-Math | Rim%, transition frequency |
| ESPN Hidden API | Deep game-level features (66/68 teams) |
| DraftKings/ESPN | Current spreads and totals |

## Quick Start

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build
```

## Deploy to Vercel

### Option 1: Import from GitHub (Recommended)
1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) and click "New Project"
3. Import your GitHub repo
4. Vercel auto-detects Vite — no config needed
5. Click "Deploy"

### Option 2: Vercel CLI
```bash
npm i -g vercel
vercel
```

## Project Structure

```
march-madness-model/
├── index.html          # Entry point
├── package.json        # Dependencies & scripts
├── vite.config.js      # Vite configuration
├── src/
│   ├── main.jsx        # React entry
│   └── App.jsx         # Full application (model + UI)
└── README.md
```

## Model Architecture

### Spread Prediction
- **Ridge Regression** (α=10) with 30 standardized features
- 5-layer feature groups: Efficiency (23.7%), Four Factors (13.9%), Momentum/Trend (20.8%), Quality/Away (26.3%), Tempo/Profile (15.2%)
- Top features: `em_traj_diff` (13.2%), `adj_em_diff` (12.3%), `away_em_diff` (11.1%)

### Total Prediction
- KenPom cross-multiplication (AdjO × AdjD) + ESPN PPG blend + tempo baseline
- 3-signal weighted average (60% ESPN / 30% KenPom / 10% Tempo)

### Confidence System
- Edge-based (not accuracy-based) — recalibrated from 2024-2025 backtest
- Toss-up specialist: model is most reliable on close games (DK < 8 pts)
- Agreement signal: boosts confidence when model and DK converge
- Big disagreement penalty on blowout games

### Monte Carlo
- 10,000 simulations per game using model spread ± conformal std dev
- Produces: win probability, cover probability, over/under probability, margin range

## Backtest Results

| Year | ATS Record | Model MAE | DK MAE |
|------|-----------|-----------|--------|
| 2025 | 16-15 (52%) | 12.9 pts | 8.8 pts |
| 2024 | 13-15 (46%) | 14.2 pts | 9.1 pts |

*Note: ESPN backtest was missing Four Factors, tempo, 3PT% data (37% of model weight zeroed out). 2026 predictions use the full feature set.*

## Updating Lines

Click the ✏️ icon next to any DK spread or total to update it. The model instantly recalculates predictions, Monte Carlo probabilities, and value assessments. Line movement tracking automatically updates.

## Disclaimer

For informational/entertainment purposes only. Not financial advice. Gamble responsibly.

---

Built with React + Vite. Deployed on Vercel.
