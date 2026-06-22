# UPV Graph Generator

Static browser app for entering Ultrasonic Pulse Velocity (UPV) readings and viewing live analysis outputs.

## What it does

- Records UPV readings by block, level, plan/zone, and location ID.
- Lets the user enter a project name and set how many locations are tested.
- Resizes the input table to match the number of tested locations.
- Supports multiple saved sheets in the browser: create a new sheet, browse saved sheets, reopen a sheet, modify it, and save it again.
- Uses 9 readings per location: 3 readings at Point 1, 3 at Point 2, and 3 at Point 3.
- Calculates point averages, location average, within-location standard deviation, and coefficient of variation.
- Ranks completed locations and lists the lowest 5 locations for destructive coring review.
- Shows summary statistics: mean, median, 25th percentile, 75th percentile, standard deviation, and normal probability plot R-squared.
- Draws live charts for normal distribution, cumulative distribution, and normal probability plot.
- Supports CSV import/export, explicit save, and browser local autosave.

## Use

Open `index.html` in a browser, or publish the repository with GitHub Pages.

Expected GitHub Pages URL:

`https://ocz0929.github.io/UPV-Graph-Generator/`

## Notes

- All calculations run in the browser. No server or internet connection is required after the page is loaded.
- Saved sheets are stored only in the current browser using local storage.
- Export CSV before clearing browser data or sharing the entered readings.
- The lowest 5 output should be reviewed with access, safety, structural representativeness, and PE confirmation before destructive coring.

## Local Verification

Run:

```bash
node verify_calculations.mjs
```

This checks the core average, ranking, percentile, and lowest-5 calculation behavior with sample readings.
