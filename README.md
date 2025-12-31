# ⭐ North Star Watchdog

**AI-Powered Minnesota Fraud Investigation Service**

🔗 **Live Site:** [ghost081280.github.io/north-star-watchdog](https://ghost081280.github.io/north-star-watchdog)

---

## 🤖 The AI Has Taken Over

This isn't your typical static website. North Star Watchdog is powered by an **autonomous AI Detective** that runs 24/7, scanning news and public databases to uncover fraud patterns in real-time.

**Every hour, the AI:**
- 🔍 Scans Google News for breaking fraud stories
- 📊 Queries free government APIs (ProPublica, FEC, OIG, USASpending)
- 🏢 Checks business registrations (OpenCorporates)
- 🚨 Detects suspicious patterns and red flags
- 📝 Updates the site automatically via GitHub Actions
- 💬 Reports high-confidence findings through GitHub Issues

**The humans just watch.** The AI connects the dots.

---

## 🎯 What It Tracks

North Star Watchdog focuses on Minnesota's massive fraud scandal - now estimated at **$250+ million** in the Feeding Our Future case alone:

| Investigation | Amount | Status |
|--------------|--------|--------|
| Feeding Our Future | $250M+ | 70+ charged, 28+ convicted |

*Stats update automatically when the AI finds new charges or convictions in the news.*

---

## 🔍 AI Detective Features

The AI Detective section shows **real-time pattern detection** with:

- **Confidence Scores** - Visual gauge showing AI certainty (not legal proof)
- **Red Flags** - Suspicious patterns detected in news and public records
- **Entity Connections** - Links between people, businesses, and organizations
- **Source Transparency** - Shows exactly which APIs returned data

### 🚨 See It In Action

The AI Detective reports findings in real-time through GitHub Issues. Watch the robot work:

👉 **[View AI Discoveries](https://github.com/Ghost081280/north-star-watchdog/issues?q=label%3Aai-detected)**

*The robots are watching.* 👀

---

## 📡 Data Sources

**News Scanning:**
- Google News RSS (real-time, hourly)

**Government APIs (Free):**
- ProPublica Nonprofits (Form 990s, financials)
- FEC Campaign Finance (contributions, committees)
- OIG Exclusions (healthcare ban list)
- USASpending.gov (federal contracts)

**Business Records:**
- OpenCorporates (company registrations)

**AI Analysis:**
- GROQ (Llama 3.1 70B) - extracts entities, patterns, red flags

---

## ⚙️ How It Actually Works

```
Every Hour:
┌─────────────────┐
│  Google News    │ ──▶ Scrape Minnesota fraud stories
└────────┬────────┘
         ▼
┌─────────────────┐
│    GROQ AI      │ ──▶ Extract names, amounts, red flags
└────────┬────────┘
         ▼
┌─────────────────┐
│  Free APIs      │ ──▶ ProPublica, FEC, OIG, OpenCorporates
└────────┬────────┘
         ▼
┌─────────────────┐
│  Update Site    │ ──▶ All data/*.json files refreshed
└────────┬────────┘
         ▼
┌─────────────────┐
│ GitHub Issues   │ ──▶ High-confidence flags reported
└─────────────────┘
```

---

## ⚠️ Disclaimer

This service is for **informational purposes only**. 

The AI Detective section is **100% autonomous** - findings are machine-generated pattern analysis, not editorial conclusions or legal accusations. Confidence scores indicate AI certainty, not legal proof.

**All individuals are presumed innocent until proven guilty.**

**Always verify information independently.**

---

## 👤 Created By

**Andrew Couch** ([@Ghost081280](https://twitter.com/Ghost081280))

U.S. Army Veteran | Serial Entrepreneur | AI Developer

---

## 📬 Contact

- Twitter/X: [@Ghost081280](https://twitter.com/Ghost081280)
- GitHub Issues: [Report bugs or suggestions](https://github.com/Ghost081280/north-star-watchdog/issues)

---

*"The robots are watching."* 🤖
