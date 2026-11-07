# PageFleet

PageFleet helps one operator turn content ideas into Page-specific Facebook posts and schedule them on the Facebook Pages they manage.

## Language

**Operator**:
The single person whose Facebook account has full control of every Page and who runs PageFleet.
_Avoid_: User, admin, account owner

**Industry**:
A line of business, such as construction works or granite, whose writing rules are shared by every Page in it.
_Avoid_: Category, niche, vertical, AI skill

**Page**:
A Facebook Page the operator is authorized to manage and has registered in PageFleet; each Page belongs to exactly one Industry.
_Avoid_: Fanpage, channel, account

**Page code**:
A short, operator-assigned code that uniquely identifies one Page inside PageFleet; it is what people type in the spreadsheet's page column and see in the Page picker.
_Avoid_: Page ID, Meta Page ID

## Content

**Content idea**:
One thing to post about — a title, a prompt for the AI, hashtags, ordered images and a posting time — aimed at one or more Pages; one spreadsheet row or one form submission.
_Avoid_: Row, brief, topic

**Post variant**:
The text written for one Page from one Content idea, in that Page's voice and its Industry's rules; it is what gets approved and scheduled.
_Avoid_: Draft, copy, version

**Batch**:
The Content ideas that arrived together from one spreadsheet import, reviewed and approved as a group.
_Avoid_: Upload, job, import

**Stagger**:
The gap in minutes added between the scheduled times of a Content idea's Post variants on successive Pages.
_Avoid_: Delay, offset, spacing

## Publishing

**Page connection**:
The Operator's authorization, obtained through Facebook Login, that lets PageFleet schedule posts on a Page; it is either connected or needs reconnect.
_Avoid_: Token, login, integration

**Delivery**:
One attempt to hand one approved Post variant to Facebook for its scheduled time, with its outcome.
_Avoid_: Job, publish, submission

**Reconciliation**:
The Operator's check of a Delivery whose outcome is unknown or failed, deciding whether the post exists on Facebook.
_Avoid_: Retry, sync
