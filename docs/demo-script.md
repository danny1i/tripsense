# TripSense — 3–5 minute demo script

**Setup (before the call):** `npm install && npm run dev`, open <http://localhost:5173> in a fresh tab. No API key needed — the header shows **Demo Mode · via BFF API**.

> Tip: keep the browser at normal motion settings so the agent steps animate. With *reduce motion* turned on they appear instantly.

---

### Step 1 — Ask in plain words (≈30 s)

Type into the big search box and press **Search**:

> Find me a cheap 4-day trip somewhere warm in November.

### Step 2 — Watch the agent work (≈30 s)

The conversation shows the agent's steps appearing one by one:

```text
✓ Understood your travel preferences
✓ Identified suitable destinations — 7 destinations warm in November
✓ Checked flights from London Gatwick
✓ Searched travel packages
✓ Filtered by your preferences
✓ Ranked matching trips
✓ Compared prices and ratings
```

Open **Agent activity** above the results to show the same steps with the **tool names** (`searchDestinations`, `searchPackages`, `compareTravelOptions`…).

Say: *"These are high-level actions and tool calls, not hidden reasoning."*

### Step 3 — Results (≈45 s)

Point at **"I understand you're looking for:"** — Warm destination · 4 days · November · Budget-friendly — and **"I found 15 trips matching your preferences."**

Say:

> "The natural-language request has been translated into structured preferences and used to search the travel dataset."

Point at one card: price, 25°C, rating, beach distance, the ✓ reasons, **Why this matches**, and the match score. Mention the transparent ranking weights in the footer.

### Step 4 — Refine by talking (≈45 s)

In the conversation box type:

> Make it cheaper and closer to the beach.

The reply says **"I've updated your search"** with:

```text
✓ Under £400
✓ Beach within 1 km
```

The chips update and the results drop to 6 trips.

Say:

> "The system retains the conversation context and applies the new constraints."

Optional: click **Filters** to show the same state in normal filters, or remove a chip with its ×.

### Step 5 — Select Tenerife (≈30 s)

Click **View trip** on a **Tenerife** card. Show the hotel, price, dates, rating, temperature, beach distance, amenities, sample itinerary, monthly climate, score breakdown and **Similar options**.

### Step 6 — Ask AI about the trip (≈20 s)

In **Ask AI about this trip**, click or type:

> Is this suitable for a couple?

The answer uses only the trip data and shows what it was **based on**.

### Step 7 — Engineering behind the experience (≈30 s)

Click **Engineering** in the header. Show the seven cards — Conversational Search, Agentic AI, BFF, Modular Frontend, Recommendation Logic, Observability, Scalable Architecture — each labelled **Implemented**, **Partly implemented** or **Production design**.

### Step 8 — The architecture (≈30 s)

Scroll to **From the browser to the cloud**:

```text
React
 ↓
BFF
 ↓
AI Agent
 ↓
Tools
 ↓
Travel Services
 ↓
AWS
```

Say:

> "The prototype focuses on proving the user experience. The documented production architecture shows how I'd evolve it into the full stack described in the role."

If there is time, scroll to the live **Observability** panel (it shows this session's searches, latency and tool calls) and the **role mapping** table.

---

## Backup questions to try

| Prompt | Shows |
| --- | --- |
| *What about Tenerife?* | Destination override keeps the other preferences |
| *Which is the best rated?* | Question about current results, no new filter |
| *Find a hotel near the beach in Tenerife* | Different tool plan (`getDestinationDetails` → `searchHotels`) |
| *Find a beach holiday for under £200* | No-result recovery: "0 options under £200, but 2 between £200–£300" |
| *Help me plan a trip* | Clarifying question |
| *start over* | Clears the context |
