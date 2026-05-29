Plan:
1.  **Refactor inline styles to Tailwind CSS classes where applicable or implement responsiveness through CSS modules/CSS classes.**
2.  **Make root container responsive:** Update `src/index.css` `#root` to have better responsiveness (e.g., width 100%, max-width 1200px) instead of fixed width.
3.  **App component responsiveness:**
    *   **Main Container:** Change the outer `div` padding and gap on smaller screens.
    *   **Header:** Currently a flex row. Make it wrap on mobile or display stats in a grid.
    *   **Main Layout Split:** The game splits into Left (Jokers) and Right (Center + Hand). Make this responsive:
        *   `flex-direction: column` on small screens.
        *   `flex-wrap` and gap changes.
    *   **Joker Slots:** Lay them out horizontally on mobile instead of vertically.
    *   **Stats row:** Currently `<div style={{ display: "flex", gap: "24px", alignItems: "center" }}>`. Add `flex-wrap: wrap` and reduce gap on small screens.
    *   **Shop Overlay:** Make the cards display in a grid that wraps nicely.
4.  **Cards and Dice components:** Ensure they shrink or wrap on small screens.
5.  **Test responsiveness:** Run `npm run dev` and ensure layout behaves properly down to mobile sizes (e.g. 375px wide).
6.  **Pre-commit steps:** Follow required project specific guidelines, check for typescript or lint issues if any.
