## STEP 7: Ingestion Health Dashboard Alert for Failures

In the ingestion health/monitoring section of the admin dashboard, add:

1. **Failed Submissions Alert**: A red banner at the top if there are ANY ingestion queue items with status 'failed' in the last 24 hours. Show count and link to details.

2. **Client-Reported Failures**: A separate section showing any submissions from /api/leads/report-failure — these are the most critical because they represent leads that were COMPLETELY lost.

3. **Email Delivery Status**: Show the last 10 email notification sends with success/failure status for each recipient.

## IMPLEMENTATION ORDER

1. **CHECK THE DATABASE** — verify ingestion_form_key exists and matches. This could fix the lead loss immediately.
2. **Fix the auth check** — make it safe (never lose leads over config issues)
3. **Fix the submission data table** — use _rawIntakeForm for the lead_data_received event
4. **Set up email sending** — install Resend or configure Nodemailer, add env vars
5. **Add redundant email notifications** — wire into ingestion pipeline
6. **Update the form CC_EMAILS** — add the Gmail backup to FormSubmit.co sends
7. **Add the report-failure endpoint** — catch total failures
8. **Update the form error handling** — capture and report errors with detail
9. **Add logging** — throughout the pipeline
10. **Backfill existing leads** — re-run the backfill with _rawIntakeForm data
11. **Update ingestion health dashboard** — show failure alerts

## FORM-SIDE CHANGES SUMMARY

Generate all form changes as a separate output that can be applied to acb-intake-form.html:

1. Set CC_EMAILS = 'advancedcollectionbureau@gmail.com'
2. Add error variable tracking (primaryError, retryError, backupError)
3. Add response status checking on FormSubmit.co backup
4. Add report-failure call on total failure
5. DO NOT change the LEAD_CONSOLE_API URL, FORM_API_KEY, or FORMSUBMIT_ID

## TESTING

After implementing, test the full pipeline:

1. Submit a test form — verify it appears in the dashboard, all fields show in the submission data table, and both email addresses receive the notification
2. Temporarily change the FORM_API_KEY in the form to a wrong value — verify:
   - Primary and retry both fail with 401
   - FormSubmit.co backup fires and you get the email
   - The lead should NOT appear in the dashboard (auth correctly rejected it)
3. Temporarily disable the /api/leads/ingest endpoint — verify:
   - Primary and retry both fail
   - FormSubmit.co backup fires
4. Check the ingestion queue for any stuck items and reprocess them