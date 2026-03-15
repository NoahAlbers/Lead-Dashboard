ACB Internal Lead Operations Console
Product Requirements Document + Technical Handoff Spec

Prepared for: Advanced Collection Bureau
Prepared for: Claude / development team implementation
Document owner: Noah Albers / ACB
Version: 1.0
Date: March 14, 2026

1. Executive Summary

Advanced Collection Bureau needs an internal web-based lead operations tool that receives inbound leads from the company website, evaluates them against business-defined qualification rules, recommends actions and referrals, and gives staff a fast, user-friendly way to contact, sort, search, log, and manage every lead.

This tool is not intended to replace a full CRM in version 1. Its purpose is to function as a lead triage, qualification, referral, and action console that sits between the website lead form and downstream systems such as staff email clients, phone clients, and Act! CRM.

The core business outcomes are:

reduce time from lead submission to first action

standardize lead qualification

make referral handling more systematic

create consistent activity logging

improve visibility into lead quality and lead outcomes

prepare qualified leads for export or sync into Act! CRM

2. Product Vision

Build an internal dashboard that helps ACB staff answer four questions instantly for every new lead:

Did a lead come in?

How good is it?

What should we do with it?

What has already happened with it?

The system should be fast, practical, highly configurable, and easy for non-technical staff to use.

3. Goals
Primary Goals

Centralize all website leads in one internal system

Score and rank leads using transparent rule-based logic

Enable staff to quickly contact, refer, or disposition leads

Recommend referral partners based on configurable business logic

Log all actions and status changes in a clean activity history

Support search, sorting, filtering, and saved views

Provide a clean path for export/import to Act! CRM

Secondary Goals

Reduce manual decision-making inconsistency

Improve staff efficiency

Improve auditability and reporting

Prepare for future automation and AI-assisted workflows

4. Non-Goals for Version 1

The following are explicitly out of scope for version 1 unless time and budget allow:

replacing Act! CRM entirely

full outbound email sending from inside the app

full telephony integration beyond opening the PC phone client

advanced AI lead scoring

complex workflow automation engine

multi-tenant architecture

customer-facing portal

marketing automation

invoicing or collections workflow management

5. Users and Roles
User Types
5.1 Admin

Responsible for configuring the system.

Permissions:

manage users

manage scoring rules

manage referral rules

manage referral partner directory

manage email templates

manage statuses

manage field mappings

manage integration settings

view all leads and logs

5.2 Intake Staff

Responsible for reviewing incoming leads and performing first actions.

Permissions:

view leads

search/filter/sort leads

open lead detail pages

use contact, call, referral, and logging actions

add notes

update statuses

view scoring reasons

cannot modify system-wide rules unless granted elevated access

5.3 Sales / Business Development

Responsible for following up on qualified leads.

Permissions:

all intake actions

assign leads to self or others if permitted

mark progress

view and update notes

mark lead outcome

export/import to CRM if permitted

5.4 Manager

Responsible for performance oversight.

Permissions:

all read access

reporting dashboards

review action logs

audit staff activity

optionally override lead assignments or statuses

6. Core Product Modules
6.1 Lead Inbox

Main dashboard/home screen for all lead review activity.

Purpose:

show incoming leads quickly

allow triage

surface top-priority leads

allow sorting/filtering/searching

Key capabilities:

table/grid listing all leads

status badges

score and quality tier

quick filters

date/time sorting

uncontacted lead views

referral candidate views

duplicate lead views

saved views

6.2 Lead Detail Page

Single-lead workspace where staff takes action.

Purpose:

show full intake details

show lead score and why it was assigned

show recommended next action

show recommended referral partner if applicable

allow one-click actions

show history and notes

6.3 Rules Engine

Admin-configurable lead qualification and action recommendation system.

Purpose:

assign lead quality score

tag leads

determine recommended next step

identify bad-fit leads

identify referral candidates

surface duplicate or incomplete leads

6.4 Referral Engine

Admin-managed referral recommendation system.

Purpose:

recommend external agencies or partners based on configurable criteria

provide prefilled referral email actions

support alternative suggestions if primary partner does not fit

6.5 Activity Log / Audit Trail

System-wide and per-lead action history.

Purpose:

show exactly what happened and when

support accountability

support reporting

reduce confusion and repeated effort

6.6 Admin Settings

System configuration center.

Purpose:

allow non-developers to maintain core business logic without code changes

7. Key Workflows
7.1 New Lead Intake Workflow

Website form submission is received

Lead record is created in the database

Raw submission payload is stored

Duplicate check is performed

Scoring rules are executed

Referral rules are evaluated

Lead status defaults to New

Lead appears in inbox

Staff reviews lead and takes action

7.2 Staff Qualification Workflow

Staff opens lead from inbox

Staff reviews full intake information

Staff sees score, tier, and rule reasoning

Staff sees recommended action:

contact lead

refer out

disqualify

assign follow-up

Staff clicks action button

Activity is logged automatically

Staff may add notes and update status

7.3 Referral Workflow

System identifies lead as potential referral candidate

System recommends best referral partner

Staff reviews recommendation

Staff clicks “Refer”

System opens default email client with prefilled referral email

Staff edits if needed and sends manually

Staff marks lead as referred

Activity log records referral event

7.4 Contact Workflow

Staff clicks email button or call button

Email button opens default mail client with prefilled subject/body

Call button opens phone/softphone client if supported

Staff completes outreach

Staff logs outcome using quick-action buttons or notes

Lead status updates accordingly

7.5 CRM Export / Import Workflow
Version 1 preferred path

Staff clicks “Export for Act!”

System generates mapped CSV export

Staff imports CSV into Act! manually

Staff marks lead as exported/imported

Later direct integration path

Staff clicks “Push to Act!”

System sends mapped fields via API

Success or failure is logged

Returned external CRM ID is stored

8. Functional Requirements
8.1 Lead Capture and Storage

The system must:

receive data from the website form

store all lead fields

store submission timestamp

store source metadata if available

store raw payload for audit/debugging

create a unique lead ID

preserve original unmodified input values

8.2 Lead Inbox / Table View

The system must provide:

paginated lead table

sorting by any visible column

filtering by any major field

free-text search

date range filters

status filters

quality tier filters

referral candidate filter

assigned user filter

duplicate filter

saved views

Suggested columns:

created date/time

company

contact name

email

phone

state

lead type

amount/size

score

quality tier

recommended action

status

assigned user

referral recommendation

last activity timestamp

8.3 Lead Detail View

The system must display:

all form fields

score

quality tier

scoring reasons

recommended action

recommended referral partner

duplicate warnings

activity log

notes

related actions

CRM status

timestamps

The system must include buttons for:

email lead

call lead

refer lead

mark contacted

mark follow-up needed

mark qualified

mark disqualified

mark duplicate

export for CRM

add note

8.4 Search and Filtering

Must support:

global keyword search

partial search matching

column-level filters

date/time sort

state filter

lead type filter

score range filter

status filter

referral partner filter

quality tier filter

assigned user filter

8.5 Status Management

Initial statuses:

New

Reviewed

Qualified

Contacted

Follow-Up Needed

Referred Out

Imported to CRM

Won

Lost

Disqualified

Duplicate

Requirements:

statuses must be editable by admin

status changes must be logged

status history must be visible per lead

8.6 Notes and Logs

The system must support:

manual notes by staff

automatic event logs

timestamps on all entries

user attribution on all entries

searchable event history

optional structured contact outcome entries

Quick log actions:

Contacted by Email

Contacted by Phone

Left Voicemail

Referral Sent

Follow-Up Scheduled

Not a Fit

Imported to CRM

Duplicate Found

8.7 Email Actions

The system must:

open default email client using mailto: or equivalent

allow customizable email templates

merge lead fields into subject and body

support at least:

intro email template

referral email template

follow-up email template

allow staff to preview/edit content before send through their mail client

log that the email action was initiated

8.8 Call Action

The system must:

open the PC’s phone client or softphone using tel: or equivalent URI if supported

log that the call action was initiated

allow the staff member to manually record the result

8.9 Referral Recommendations

The system must:

recommend referral partners based on configured logic

show why a partner was recommended

allow staff override

support primary and fallback recommendations

allow inactive/active referral partner status

allow different email templates per partner if needed

8.10 Scoring and Qualification

The system must:

score each lead on creation

allow score recalculation

show score reasons

classify lead into quality tiers

allow admin edits to scoring rules

support additive and subtractive rules

support hard-stop disqualifying rules

8.11 Duplicate Detection

The system should:

flag likely duplicates based on configurable logic

optionally compare:

company name

email

phone

contact name

allow manual duplicate designation

store related/original lead reference

8.12 CRM Integration Support

Version 1 must:

support export to CSV in a format suitable for Act! import

allow admins to map fields

log export actions

Later versions may:

support direct Act! API push

store returned CRM ID

show sync status

retry failed syncs

9. Form Fields / Lead Data Inputs

The developer should map the exact website form fields from advancedcb.com before implementation. The system must be flexible enough to support current and future fields without requiring major code changes.

Suggested Canonical Lead Fields
Identity / Contact

first_name

last_name

full_name

company_name

title

email

phone

alternate_phone

Location

address_1

address_2

city

state

zip

country

Business / Case Data

industry

debt_type

balance_amount

estimated_claim_value

account_volume

service_requested

notes_from_form

urgency

business_type

geographic_scope

Metadata

lead_source

source_page

utm_source

utm_medium

utm_campaign

referrer

ip_address if legally/operationally appropriate

created_at

raw_payload_json

Internal Derived Fields

score

quality_tier

status

recommended_action

recommended_referral_id

assigned_user_id

duplicate_of_lead_id

10. Scoring System Design
Guiding Principle

Version 1 scoring must be rules-based and transparent, not AI-dependent.

Staff must be able to understand why a lead received a score.

Scoring Model

Suggested approach:

start from a base score

apply positive and negative rule adjustments

cap score between 0 and 100

map score to a quality tier

Example:

Base score: 50

Positive examples:

In Florida: +15

Commercial/business debt: +20

Estimated balance above threshold: +20

Complete phone and email provided: +10

Industry in preferred market segment: +10

Negative examples:

Outside target geography: -20

Consumer-only debt: -25

Missing key contact info: -15

Very small claim size: -20

Duplicate lead: -50

Hard stop examples:

spam/test lead -> disqualify

missing all valid contact methods -> disqualify

invalid geography + invalid service type -> referral/disqualify

Quality Tier Mapping

Suggested:

80–100 = A Lead

60–79 = B Lead

40–59 = C Lead

0–39 = Poor Fit / Refer / Disqualify

Required Admin Features

Admins must be able to:

enable/disable rules

reorder rule priority

modify rule values

define condition logic

define rule output

test rules against a sample lead

Score Explanation UI

The lead detail page should show something like:

Lead Score: 78 (B Lead)

Applied Rules:

+15 Florida target market

+20 Commercial debt

+10 Contact info complete

-17 Outside preferred claim size range

Net result:

Recommended Action: Contact

Secondary Recommendation: Review manually

11. Referral Recommendation System
Purpose

When a lead is not ideal for ACB but still valid, the system should recommend a referral partner.

Referral Partner Record

Each partner should include:

name

active/inactive

contact_name

email

phone

website

states_served

industries_served

specialties

preferred lead types

minimum claim size

maximum claim size

exclusions

notes

default referral email template

ranking priority

Matching Logic

Example conditions:

If lead state is outside ACB service territory, match partner covering that state

If claim type is outside ACB niche, match specialized partner

If lead size is too small for ACB, match a small-balance partner

If legal-only matter, recommend legal referral

If healthcare niche and partner specializes in healthcare, boost ranking

Recommendation Output

The UI should show:

recommended partner

reason

backup partner(s)

action button to generate referral email

Example:
Recommended Referral: Agency X
Reason: Serves Georgia, handles commercial collections, accepts balances in this range.

12. Email Template System
Template Types

intro email to lead

referral email to partner

follow-up email to lead

internal handoff email

Requirements

Templates must support merge variables such as:

{{full_name}}

{{company_name}}

{{email}}

{{phone}}

{{state}}

{{industry}}

{{balance_amount}}

{{assigned_user_name}}

{{referral_partner_name}}

Template Fields

template_name

template_type

subject_template

body_template

active

created_by

updated_at

Behavior

When the user clicks the email button:

generate subject/body from the template

open default mail client

prefill recipient and content

log action initiation

13. User Interface Requirements
13.1 General UX Principles

The application should be:

clean

fast

easy for non-technical staff

optimized for frequent repetitive actions

designed to reduce clicks

13.2 Lead Inbox Layout

Suggested sections:

top bar with search

filter row

saved views

lead table

quick stats summary cards

Suggested quick stats:

New Today

Uncontacted

High Quality Leads

Referral Candidates

Follow-Up Needed

Duplicate Flags

13.3 Lead Detail Layout

Suggested layout:

Left Column

lead identity and contact info

company and business details

intake summary

raw submitted fields if needed

Right Column

score and quality tier

scoring reasons

recommended next action

referral recommendation

action buttons

CRM state

Lower Section

activity timeline

notes

status history

13.4 Required UI Elements

badges for status and quality tier

sortable tables

date filters

modals/drawers for notes and action confirmations

clear action buttons

consistent form controls

responsive layout for desktop-first use

14. Reporting Requirements

Version 1 reporting can be lightweight.

Manager Dashboard Metrics

number of leads by date range

leads by status

leads by quality tier

leads referred out

leads contacted

leads imported to CRM

average time to first action

conversion counts if tracked

top referral partners used

Future Reporting

lead source performance

staff productivity

score-to-conversion correlation

rule effectiveness

referral outcome reporting

15. Technical Architecture
Recommended Stack
Frontend

Next.js (React)

TypeScript

component library such as shadcn/ui or similar

data table library for advanced sorting/filtering

Backend

Preferred options:

Next.js server actions / API routes

or separate Node.js/TypeScript API

or Python FastAPI if preferred by implementation team

Database

PostgreSQL

ORM

Prisma if using TypeScript

SQLAlchemy if using Python

Hosting

Potential options:

Vercel + managed Postgres

Railway

Render

AWS

Azure

internal private deployment if preferred

Architectural Style

Use a conventional web app architecture:

browser frontend

authenticated app server/API

relational database

optional integration service layer for CRM later

16. Recommended Data Model
16.1 leads

Core record for every inbound lead.

Fields:

id

created_at

updated_at

source

first_name

last_name

full_name

company_name

title

email

phone

alternate_phone

address_1

address_2

city

state

zip

country

industry

debt_type

balance_amount

estimated_claim_value

account_volume

service_requested

notes_from_form

urgency

lead_source

source_page

utm_source

utm_medium

utm_campaign

referrer

raw_payload_json

status

score

quality_tier

recommended_action

recommended_referral_id

assigned_user_id

duplicate_of_lead_id

last_activity_at

crm_status

crm_external_id

16.2 lead_events

Immutable activity log.

Fields:

id

lead_id

user_id nullable for system events

event_type

event_data_json

created_at

Example event types:

lead_created

score_calculated

status_changed

note_added

email_action_opened

call_action_opened

referral_action_opened

referral_marked_sent

crm_exported

crm_imported

duplicate_flagged

assigned_user_changed

16.3 lead_notes

Fields:

id

lead_id

user_id

note_body

created_at

updated_at

16.4 scoring_rules

Fields:

id

name

description

enabled

priority

conditions_json

outcomes_json

created_at

updated_at

16.5 referral_partners

Fields:

id

name

active

contact_name

email

phone

website

states_served_json

industries_served_json

specialties_json

preferred_lead_types_json

minimum_claim_size

maximum_claim_size

exclusions_json

notes

default_email_template_id

ranking_priority

created_at

updated_at

16.6 email_templates

Fields:

id

name

type

subject_template

body_template

active

created_by_user_id

created_at

updated_at

16.7 users

Fields:

id

name

email

password_hash or SSO identity

role

active

created_at

updated_at

16.8 saved_views

Fields:

id

user_id

name

filters_json

sort_json

created_at

updated_at

16.9 crm_exports

Fields:

id

lead_id

system_name

status

payload_json

external_id

attempted_at

completed_at

error_message

17. API / Backend Capability Requirements

The implementation should expose or internally support endpoints/services for:

Lead Management

create lead from web form

list leads

search leads

get lead by ID

update lead

change status

assign lead

mark duplicate

Notes / Logs

create note

fetch notes

fetch activity log

Rules

list rules

create/edit/delete rule

test rule

recalculate lead score

Referral

list referral partners

create/edit/deactivate partner

evaluate recommendation for lead

Templates

list templates

create/edit templates

preview rendered template

CRM

export mapped CSV

optional later: push to Act! API

get CRM sync status

Auth / Users

login/logout

user list

role enforcement

18. Security and Access Control

The system will contain sensitive business lead data and must include:

HTTPS

authenticated access only

role-based permissions

audit logging

secure password storage or SSO

secret management for integrations

server-side validation

input sanitization

protection against CSRF/XSS/SQL injection

database backup strategy

Recommended:

log admin configuration changes

restrict export permissions to appropriate roles

keep raw payload access limited if sensitive

19. Integration Notes
19.1 Website Form Integration

The app must receive leads from advancedcb.com.

Possible approaches:

direct POST from the website form to the internal API

webhook endpoint

middleware script on website backend

form tool integration if site uses a CMS/form plugin

Developer must determine:

current website platform

form technology

current submission flow

anti-spam measures already in place

19.2 Email Client Integration

Version 1 should rely on:

mailto: links or equivalent URI generation

merge templates into subject/body

log initiation event

19.3 Phone Client Integration

Version 1 should use:

tel: links or softphone URI if available

log initiation event

19.4 Act! CRM Integration

For version 1:

implement export to CSV with configurable field mappings

Later:

investigate direct API push

store credentials securely

store external IDs

implement retry/failure handling

20. Act! CRM Implementation Strategy
Version 1 Recommendation

Do not make Act! direct sync a blocker for launch.

Implement:

CSV export matching Act! import format

field mapping admin config

export history log

Version 2 Recommendation

Add:

direct API integration if environment supports it

push individual lead to Act!

update sync status

save external ID

handle API errors gracefully

21. Suggested Business Rules Examples

These are placeholders and should be editable by admins.

Qualification Examples

If state = Florida, add 15

If service_requested = commercial collections, add 20

If balance_amount > 10000, add 20

If email exists and phone exists, add 10

If debt_type = consumer, subtract 25

If state not in target geography, subtract 20

If form appears incomplete, subtract 15

If duplicate match confidence > threshold, subtract 50

Disqualifying Examples

Missing both phone and email

test/spam submission

invalid service type not handled by business

Referral Examples

If state outside target area and referral partner covers that state, recommend that partner

If lead size too small for ACB, recommend small-balance partner

If lead industry is outside target but partner specializes in it, recommend partner

If legal-only matter, recommend legal referral source

22. Saved Views to Include by Default

Recommended defaults:

New Today

New This Week

Uncontacted

High Score Leads

Referral Candidates

Duplicates

Follow-Up Needed

Imported to CRM

Disqualified

My Assigned Leads

23. MVP Scope

The MVP should include:

secure login

lead ingestion from website

lead inbox table

lead detail page

scoring engine

referral recommendation engine

status management

notes

activity log

email action buttons

call action button

search/filter/sort

saved views

CSV export for Act!

admin pages for templates, rules, referral partners

This is enough to create real operational value without overbuilding.

24. Phase 2 Scope

Potential additions:

direct Act! API integration

assignment routing rules

SLA / aging indicators

automated reminders

bulk actions

duplicate merge workflow

dashboard analytics

better reporting

notifications

advanced template editor

25. Phase 3 Scope

Potential future features:

AI-generated lead summaries

AI recommendation assist

predictive lead quality suggestions

automated suggested next actions

email tracking if integrated with mail systems

deeper telephony integration

workflow automation engine

source attribution analytics

26. Acceptance Criteria for MVP

The MVP is acceptable if:

A new website lead appears in the system automatically

Staff can open the lead and see all details clearly

The lead receives a score and quality tier automatically

Staff can see why the score was assigned

Staff can search, filter, and sort leads easily

Staff can open a prefilled intro email

Staff can open a call action

Staff can log actions and notes

Staff can see referral recommendations where applicable

Staff can generate a CRM-ready export

Admins can manage rules, referral partners, and templates without developer assistance

27. Recommended Build Priorities for Claude
Priority 1

Set up:

auth

database schema

lead ingestion pipeline

lead inbox

lead detail page

Priority 2

Build:

scoring engine

scoring explanation UI

statuses

notes and logs

Priority 3

Build:

email action generator

call action button

referral partner directory

referral recommendation engine

Priority 4

Build:

admin settings pages

saved views

CSV export to Act!

Priority 5

Polish:

permissions

reporting

validation

QA

deployment

28. Recommended Implementation Notes for Claude

Build with maintainability in mind; avoid hardcoding business rules

Store rules and mappings as database records wherever practical

Keep system logic transparent and inspectable by admins

Prefer a modular service structure:

lead ingestion service

scoring service

referral service

logging service

CRM export service

Use immutable event logging for auditability

Build the UI for speed and clarity, not visual complexity

Assume desktop-first usage

Design schemas to allow future additional fields without major rewrites

Use optimistic but safe validation on all user inputs

Keep the first release narrow and reliable

29. Open Questions for Implementation Discovery

These should be answered before coding or early in coding:

What exact fields exist on the current advancedcb.com lead form?

What platform powers the website and form?

Does ACB want direct email sending later or only email-client launch?

What phone client or VoIP software is used on staff PCs?

What exact field mapping is needed for Act! CRM?

What are the current qualification rules the team already uses mentally?

What are the known referral partners and their fit criteria?

Should leads be manually assigned, automatically assigned, or both?

Are there any compliance or retention requirements for stored lead data?

Should managers see dashboards in version 1 or later?

30. Final Product Framing

This application should be treated as a:

Lead Operations Console

Not:

a full CRM replacement

a marketing automation platform

a collections management platform

Its job is to:

intake

rank

recommend

act

log

hand off

If implemented correctly, it will become the operational front door for inbound leads and reduce lead response friction significantly.

31. Suggested First Prompt to Give Claude

Use this as the starter prompt:

Build a production-ready internal web app called “ACB Lead Operations Console” using Next.js, TypeScript, PostgreSQL, and Prisma.
The app should ingest website leads, store them, score them using configurable rules, recommend referral partners based on configurable logic, display all leads in a searchable/sortable inbox, and provide detailed lead pages with notes, activity logs, status management, email/call/referral action buttons, and CSV export for Act! CRM.

Build the app with a modular architecture and admin settings for scoring rules, referral partners, email templates, statuses, and field mappings.

Start by scaffolding:

auth and role structure

database schema

lead ingestion endpoint

lead inbox page

lead detail page

scoring engine service

activity log service

referral recommendation service

admin pages

CSV export service

Use the following PRD/technical specification as the source of truth:
[paste this full document]

32. Appendix A: Example Lead Detail Page Layout
Header

Lead name / company

status badge

score badge

created date

assigned user

Section 1: Contact Info

contact name

email

phone

company

state

industry

Section 2: Intake Summary

service requested

debt type

balance amount

notes from form

source metadata

Section 3: Qualification

score

quality tier

scoring explanation

recommended action

Section 4: Referral

recommended partner

reason

alternate partner

refer button

Section 5: Actions

email lead

call lead

mark contacted

mark follow-up needed

mark qualified

mark disqualified

export to CRM

add note

Section 6: Activity Timeline

Chronological event list

Section 7: Notes

Manual staff notes with timestamps and user names

33. Appendix B: Example Lead Inbox Columns

Created At

Company Name

Contact Name

Email

Phone

State

Industry

Service Requested

Balance Amount

Score

Quality Tier

Recommended Action

Referral Recommendation

Status

Assigned User

Last Activity

34. Appendix C: Example Event Log Entries

2026-03-14 10:02 AM — System — Lead created from website form

2026-03-14 10:02 AM — System — Score calculated: 82

2026-03-14 10:02 AM — System — Referral check completed: none recommended

2026-03-14 10:09 AM — Jane Doe — Opened intro email action

2026-03-14 10:12 AM — Jane Doe — Marked lead as Contacted

2026-03-14 10:13 AM — Jane Doe — Added note

2026-03-14 10:15 AM — Jane Doe — Exported lead for Act!

35. Appendix D: Example Email Templates
Intro Email

Subject:
Introduction from Advanced Collection Bureau regarding {{company_name}}

Body:
Hi {{full_name}}, Thank you for reaching out to Advanced Collection Bureau. We reviewed your inquiry and would love to learn more about your needs. Please reply to this email or call us at [insert number]. Best, {{assigned_user_name}}

Referral Email

Subject:
Referral Introduction for {{company_name}}

Body:
Hi {{referral_partner_name}}, We received an inquiry from {{full_name}} at {{company_name}} that appears to be a better fit for your organization based on geography and/or service type. Their contact details are below: Email: {{email}} Phone: {{phone}} State: {{state}} Notes: {{notes_from_form}} Best, {{assigned_user_name}}