# Haven — Find the Place for Your Moment

**Student Name:** Marc Aboudib  
**Course:** Full Stack Development Final Project  
**Institution:** Lebanese University · Faculty of Engineering, Branch 2  

---

## 📝 Project Description
Haven is a responsive web application built to help users discover curated and live wedding and vacation venues locally (Lebanon) and globally. The application provides an elegant, distraction-free workspace layout designed to help users source venues with confidence.

## 🔌 APIs Used
This project utilizes a keyless, public open-source hybrid data engine:
1.  **Nominatim Geocoding API:** Converts free-text city queries dynamically into geographic coordinate pairs.
2.  **Overpass API (OpenStreetMap):** Executes spatial bounding radius queries to pull real-time nearby landmark nodes (attractions, historical sites, museums, parks, and beaches).

## 🛠️ Custom Requirement Explanation
Rather than relying on strict, binary hard-filters that frequently dead-end into frustrating "0 results" pages, the core of Haven's Discovery Engine implements a **Faceted Scoring Search Matrix**. 
* Hard filters are reserved only for strict parameters (Region and Text Queries).
* All other independent facets (Type, Price, Serenity, Atmosphere, and Interests) are compiled into a user preference vector. The application scores matching items and automatically floats the highest scoring venues to the top of the viewport.

---

## 🤖 AI-Use Appendix

### Tools Used
* Gemini / ChatGPT

### Key Prompts Used
* *"How can I safely query the Overpass API using a bounding circle around geocoded coordinates without getting a 400 Bad Request?"*
* *"Write a reusable, vanilla JavaScript infinite carousel component that uses cloned nodes for seamless visual looping."*

### What the AI Got Wrong
* **Overpass Query Space Sensitivity:** The AI initially generated an Overpass query string containing spaces inside the `(around:3000, ${lat}, ${lon})` syntax. This triggered bad request errors at runtime because the Overpass QL spec strictly forbids spaces separating spatial arguments. It had to be corrected to tightly parsed floats with no spacing.
* **Component Instantiation Errors:** The AI script initially attempted to initialize the `Carousel` object indiscriminately on page load inside `destinations.js`. This caused execution failures on pages where the DOM carousel nodes didn't exist or where the script was omitted, requiring the addition of explicit defensive programming type checks before execution.
