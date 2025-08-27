# Open Docs
(work in progress)

Publish your Google Docs for your community.

## Problem
Whenever I develop or contribute to a collective, I always end up with plenty of Google Docs here and there. A FAQ, some documentation about how to use this or that. Etc. 

When I need to create a newsletter or a blog post, I first start with a Google Doc. It's just the easiest way to create a draft pass it around to get quick feedback.

Then I have to go through the pain of copy pasting the text, re-uploading the photos, etc.

## Solution

Keep all the documents related to your collective in a google drive folder and publish them on your website (or subdomain). That way, anyone can quickly access them and suggest edits.

Great for your blogging, posting updates, newsletters or general documentation about how your collective works.

## How to use

Create a folder with your domain name (e.g. docs.commonshub.brussels) and share it with docs@opencollective.xyz (need to give editor access). Move your documents there. The name of the document will be its url (e.g. https://docs.commonshub.brussels/faq). Homepage should be called "index".

## How to deploy this utility locally?

You first need to create an `.env` file.

```bash
$> cp .env.example .env
```

To avoid relying on the google api on every request, we fetch new documents on a regular basis (and generate a markdown and PDF version that we save locally).

This is done with the following command:

```bash
$> deno task sync
```

For this to work, you need a "google service account" and save its key in `service-account-key.json` in the root directory of the app (or you can specify a different path/filename in the env variable `GOOGLE_SERVICE_ACCOUNT_KEY_PATH`).

To create and download the key:

Open [Google Cloud Console](https://console.cloud.google.com) → IAM & Admin → [Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts/)).
Create or select a service account. Go to Keys → Add key → Create new key → JSON, then download.
Save the file as service-account-key.json in this project root.


1. Create a folder with the name of your website (e.g. docs.commonshub.brussels)
1. Share it with edit permissions with your service account address (protip: create a google group with a easier email address to remember and add the service account to it, e.g. docs@opencollective.xyz)
1. Create a Google Doc name "index" to represent your homepage
1. Enjoy it on https://docs.opencollective.xyz/docs.commonshub.brussels (or directly on https://docs.commonshub.brussels if you update your DNS to point to `91.98.16.1`)


## TODO
- [x] Check for modified time to avoid refetching everything
- [x] Add RSS feed 
- [ ] Add subscribe by email
- [ ] Add edit / suggest edits links in the footer based on permissions
- [ ] Document how to set a footer
