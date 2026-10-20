---
title: ForecastLabAI — forecasting model families
tags: [forecastlabai, interview, forecasting, scikit-learn]
source: "ForecastLabAI @79e8dce (app/features/forecasting/models.py, app/core/config.py) + interview-prep review 2026-10-19"
created: 2026-10-19
---

# ForecastLabAI — forecasting model families

## Problem
Name the implemented models, the shared interface, and which ones are optional — correctly.

## Instant solution
All models implement `BaseForecaster` (`app/features/forecasting/models.py`): `fit()`, `predict()`, `get_params()`, `set_params()`.

| Model | Class | Idea | Why it is there |
|---|---|---|---|
| Naive | `NaiveForecaster` | repeat last value | simplest baseline |
| Seasonal naive | `SeasonalNaiveForecaster` | repeat last season | recurring patterns |
| Moving average | `MovingAverageForecaster` | mean of recent values | noise reduction |
| Weighted MA | `WeightedMovingAverageForecaster` | recent values weigh more | recency |
| Seasonal average | `SeasonalAverageForecaster` | mean per seasonal position | seasonal baseline |
| Trend regression | `TrendRegressionBaselineForecaster` | fit a time trend | trend extrapolation |
| Regression (`regression`) | `RegressionForecaster` | `HistGradientBoostingRegressor` on features | tabular ML, exogenous what-if |
| Random forest | `RandomForestForecaster` | independent trees, averaged | nonlinear interactions |
| LightGBM | `LightGBMForecaster` | fast gradient-boosted trees | larger workloads |
| XGBoost | `XGBoostForecaster` | regularized boosted trees | advanced regression |
| Prophet-like | `ProphetLikeForecaster` | SimpleImputer + Ridge additive model | interpretable trend/season parts |

## Why it works / gotchas
- **Feature-flagged, off by default:** only `random_forest`, `lightgbm`, `xgboost` (`app/core/config.py`). LightGBM/XGBoost also need the extras `ml-lightgbm` / `ml-xgboost`.
- `prophet_like` is **custom scikit-learn**, not the Meta Prophet package, and it is not flagged.
- The "gradient-boosted regression" from the review is `RegressionForecaster` (model type `regression`).
- Baselines first: if a complex model cannot beat seasonal naive in backtests, its cost is not justified.
- Random forest = parallel independent trees (variance reduction); boosting = sequential trees fixing previous residuals.

## Diagram brief
- Type: class/tree diagram.
- Root `BaseForecaster` (fit · predict · get_params · set_params).
- Three branches: Baselines (naive, seasonal naive, MA, weighted MA, seasonal average, trend regression) · ML (regression/HistGB, random forest, LightGBM, XGBoost) · Additive (prophet_like = Imputer + Ridge).
- Badge "flag, default off" on random forest, LightGBM, XGBoost; badge "extra" on LightGBM, XGBoost.
