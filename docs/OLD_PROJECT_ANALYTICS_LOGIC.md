OLD PROJECT ANALYTICS LOGIC REFERENCE
Purpose of this document

This document explains the logic of the old project so it can be used as a reference blueprint for implementing analytics inside the current university project.

The goal is NOT to copy the old project, but to reuse its logical concepts, especially:

event performance analytics

rating summaries

feedback analysis

sentiment interpretation

KPI scoring

trend analysis

insights generation

All logic must be adapted to the current project's database and architecture.

1. Old Project Overview

The old project was an event feedback and analytics platform.

Its main purpose was to:

Collect event reviews and ratings

Analyze user feedback

Generate analytics dashboards

Provide event performance insights

Users could:

rate events

leave comments

view analytics dashboards

analyze event performance

Admins could:

review feedback

override incorrect sentiment

export reports

2. Core Data Entities

The old system was based mainly on two core entities.

Event

Represents an event in the system.

Typical fields:

id

title

date

location

createdAt

updatedAt

Events are used as the main grouping unit for analytics.

Review / Feedback

Represents a user's feedback for an event.

Typical fields:

id

eventId

rating (1–5)

comment (optional)

sentiment (model predicted)

overrideSentiment (admin corrected)

sentimentScore

language

createdAt

updatedAt

Each review is always associated with exactly one event.

3. Effective Sentiment Rule

The system defines two types of sentiment:

Model Sentiment

Generated automatically by the sentiment analysis system.

Override Sentiment

Set manually by an administrator.

Effective Sentiment

The final sentiment used in analytics is defined as:

effectiveSentiment =
overrideSentiment if present
otherwise model sentiment

All analytics calculations must always use effective sentiment.

4. Rating Logic

Ratings are simple numeric values between 1 and 5.

They are used to compute:

average rating

rating distribution

performance labels

Average Rating

Average rating is calculated as:

averageRating = sum(all ratings) / totalReviews
Rating Distribution

Count how many reviews gave:

1 star

2 stars

3 stars

4 stars

5 stars

This distribution is used to display rating charts.

5. Sentiment Distribution

Sentiment analytics count the number of:

positive reviews

neutral reviews

negative reviews

The percentages are calculated using:

sentimentPercentage =
sentimentCount / totalReviews

These values are used to show:

sentiment charts

performance indicators

6. Event Performance Label

Events are categorized based on average rating.

Example logic:

Average Rating	Performance
≥ 4.0	Good
≥ 3.0	Okay
< 3.0	Needs Improvement

If no reviews exist, the system must show:

No Data
7. KPI Score Logic

The old project used a combined KPI score to evaluate event performance.

The score combined three factors:

Rating Score

Based on average rating.

Sentiment Score

Based on positive vs negative sentiment ratio.

Engagement Score

Based on the number of reviews.

KPI Formula Concept
KPI Score =
50% rating score
35% sentiment score
15% engagement score

The final score is categorized into tiers:

Score	Tier
≥ 85	Excellent
≥ 70	Good
≥ 55	Needs Improvement
< 55	Critical
8. Trend Analysis

The system analyzes how event sentiment changes over time.

Reviews are grouped by day.

For each day the system calculates:

number of reviews

average rating

positive %

neutral %

negative %

This allows dashboards to show trend charts.

9. Cross-Event Benchmarking

The old project compared each event to all other events.

Metrics compared:

average rating

positive sentiment percentage

This allowed dashboards to show:

university average

event performance relative to others

percentile ranking

10. Feedback Topics

Comments were analyzed for topics.

Topics were detected using keyword matching.

Examples:

organization

venue

content

speakers

communication

registration

The system counted how often each topic appeared.

11. Improvement Suggestions

The system generated suggestions based on:

low ratings

high negative sentiment

poor aspect scores

Examples:

improve organization

improve venue logistics

improve communication

12. Risk Alerts

The system also detected risk signals.

Examples:

very low rating

high negative sentiment

sudden increase in negative feedback

low review volume

These alerts were displayed in the dashboard.

13. Important System Rules

These rules must always remain true.

Rule 1

Every review must belong to a valid event.

Rule 2

Sentiment must always exist for every review.

If NLP fails, sentiment must default to:

neutral
Rule 3

Analytics must always use effective sentiment.

Rule 4

Analytics must be computed from stored data only.

No fake or generated data may be used.

14. How This Logic Should Be Used In The New Project

The new university project must reuse this logic, but adapt it to the existing system.

The goal is to implement:

Event Performance Analysis

inside the existing dashboard.

Important Adaptation Rules

The new implementation must:

inspect the current database first

reuse existing event/review/feedback data

adapt analytics to the current schema

not assume the schema is identical

Dashboard Integration Rules

Analytics must appear:

ONLY under the existing filters

The implementation must:

not create new pages

not redesign the dashboard

not modify existing filters

The filters must control the analytics results.

Data Rules

Analytics must use only:

real events

real feedback

real ratings

real timestamps

real database data

If a metric has no data:

show an empty state

do not generate fake values.

15. Final Objective

The purpose of using this old project logic is to implement a clean Event Performance Analysis dashboard in the current project.

The implementation must:

preserve the current UI

preserve the current filters

adapt the analytics logic to the existing database

provide meaningful insights from real data.