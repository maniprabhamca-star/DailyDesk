// The public changelog — curated, user-facing entries (never raw commit spam).
// Newest first. Keep entries in plain product language: what changed for the
// person using the tool, not how the sausage was made. Add an entry with every
// meaningful ship — this file IS the /changelog page.

// 'new' means a NEW TOOL — a page that did not exist before. A capability added
// to a tool that already exists is 'feature'. Conflating the two put "New tool"
// on top of a compression preview change, which is simply untrue.
export type ChangeKind = 'new' | 'feature' | 'improved' | 'fixed' | 'ai' | 'launch';

export type ChangeEntry = {
  date: string; // YYYY-MM-DD
  kind: ChangeKind;
  title: string;
  detail: string;
  href?: string; // deep link to the tool/page it concerns
};

// ⏳ HELD BACK until they un-gate (they are coming_soon / owner-only today, and
// a "new" entry pointing at a door the reader can't open is worse than silence):
// PDF to EPUB · HTML to Excel · Video to MP3 + audio converter. Draft copy for
// all three is in docs/designs/master-roadmap.md §5b — add them the day the
// flags flip, dated then.
export const CHANGELOG: ChangeEntry[] = [
  {
    date: '2026-11-23',
    kind: 'improved',
    title: 'The page allowances on the pricing page are now real numbers',
    detail:
      'Two numbers on the pricing page were decoration. Pro says 20 bank-statement pages a month and Business says 300, and the server that counts them had one rule for everybody who had paid anything: unlimited. A $5.98 Pro plan and a $19 Business plan got exactly the same thing, which meant the tier we launched yesterday had no volume advantage at all outside the marketing. The same mistake ran the other way on AI: Business is sold with 200 actions a month and was receiving Pro’s 50, because one cap served every account.\n\nBoth now read the plan. Free gets 5 pages, Pro 20, Business 300, and the AI allowance follows the same table. The owner account is the only one left with no ceiling.\n\nTwo details that are deliberate rather than accidental. A statement longer than your allowance still converts — if you are on Pro with 20 pages and you open a 40-page statement, you get your 40 pages and the next statement is the one that asks you to upgrade. Refusing the job that would overshoot means a Pro subscriber with one long statement could never convert anything, which is a worse answer than counting honestly and letting one job run long. And if our meter cannot be read at all, the conversion goes ahead. A problem at our end is not your problem, and the file was already parsed on your own machine by then anyway.\n\nNone of this sends us your statement. It never has. The browser does the parsing and sends a page count — one integer — which is the only way to meter a tool that is deliberately built never to see the document.',
    href: '/bank-statement-converter',
  },
  {
    date: '2026-11-23',
    kind: 'improved',
    title: 'We re-read every competitor price on the comparison page, and three of them were wrong',
    detail:
      'The comparison page carries other companies’ prices, which means it goes stale without anybody touching it. It said Adobe Acrobat was $19.99–29.99 a month. Acrobat’s own plans page says $14.99–24.99. We were quoting a competitor as five dollars dearer than they are, on a page whose entire argument is that we checked. That is the one kind of error this page cannot afford, so all four companies were read at the source this morning and the date is printed at the top in words rather than a vague month.\n\nThe free-tier row is more useful now too. “Limited” told you nothing; what Smallpdf actually publishes is a daily download limit on twenty-one named tools — Merge, Split, Rotate, Delete Pages, Basic Compression, Annotator, Sign, Protect and every Office conversion among them. That is most of what their subscription lifts. iLovePDF calls its own free tier “limited document processing” and runs ads against it. Naming the thing is fairer to them than a shrug, and it makes the difference legible without us having to characterise it.\n\nAnd there is a new table for the one place where we are not the cheap option by a rounding error. Bank statement conversion is sold by the page by the products built for it, so that is how it is compared: DocuClipper’s entry plan is $29 a month for 60 pages, which is 48.3 cents a page; our Business tier is $19 for 300, which is 6.3 cents — 7.6× cheaper per page, and still cheaper per page than their $279 tier. Two things are said in their favour on the same page, because a comparison that only flatters us is not worth reading: every seat is included on their plans, which is a real advantage over our single-user Business tier, and they sell overage pages at ten cents, which we do not need to because the parsing runs on your own machine.',
    href: '/compare',
  },
  {
    date: '2026-11-23',
    kind: 'improved',
    title: 'We were selling two things that did not add up to a plan',
    detail:
      'Until today the pricing page offered Pro at $5.98 a month and, further down the same page under its own heading, a separate Bank Statement Converter subscription at $19. Those two prices were set months apart and nobody had ever put them side by side. If you convert client statements for a living AND want batch processing and PDF editing, you had to buy both: $24.98, two renewal dates, two cancel buttons, and no plan on the page that described what you actually do.\n\nSo there is a third tier now, and it is not a new price. Statements Pro has become Business and absorbed all of Pro, at the same $19 — 300 bank-statement pages a month, exports to Tally, QuickBooks and OFX, saved per-client presets, and every Pro feature included. Nothing we had published got more expensive, everyone who was going to buy the statement converter now gets Pro thrown in, and the two-subscription problem is simply gone. In India it stays at ₹1,499, which was always the figure in the spec rather than a currency conversion.\n\nThe statement converter no longer has its own price list below the table, because that is exactly how a capability turns into a fourth subscription. Its allowances are rows in the comparison table now, next to everything else, where you can see what each tier gets. The one-time 20-page credit pack survives as a footnote — it is still the only thing we sell to somebody who will not take a subscription.\n\nThe forms libraries were missing from the pricing page entirely, which is worth saying plainly: the page was arguing for us on tools every competitor also has, and saying nothing about the one thing none of them do. There is a Government forms section in the comparison table now — 62 forms across 13 issuing authorities, every one re-checked at the source with the date shown, no account needed. Every row of it is identical across Free, Pro and Business, because it is free and it stays free. If you were wondering whether that is a paid feature: it is not, and there is no plan on that page that unlocks more of it. The comparison page had the same hole, and it is filled with a sourced row: all four of us can fill in a PDF form, but knowing which form to fill is a different thing, and neither Smallpdf’s tools page nor iLovePDF’s home page lists anything of the kind — checked on the day this shipped. The sites that do sell it are template subscriptions. There is also a link from the pricing table through to that page now, which there should have been all along.\n\nOne piece of small print that is deliberately not small: the founding offer, where the first 1,000 members lock in $4.99 a month for life, applies to Pro and not to Business. That is now written wherever the offer appears. A lifetime discount is not something you can take back from someone who already bought under it, so it had to be on the page before anyone could, not added afterwards.',
    href: '/pricing',
  },
  {
    date: '2026-11-23',
    kind: 'new',
    title: 'One place for the forms, and a check date you can actually read',
    detail:
      'There are two form libraries here — thirty US federal forms and thirty-two Indian statutory ones — and until today the only way to find out was to already know. There is now a single page at /forms that opens both, says what each one covers, and states the three rules they both follow: we host no copies of any form, we say when we last checked it at the source, and the filling happens on your own machine.\n\nThe check date changed shape too. Every US form page used to say "measured at the source on November 23, 2026", which is true and almost useless — you had to work out for yourself whether that was last week or last spring. It now says "checked 3 days ago", and if it ever starts saying "checked 6 weeks ago — due a re-check" in amber, that is deliberate. A date is only worth printing if we are willing to show it going off.\n\nThe weekly check now covers the Indian library as well. Those pages make no claim about a revision, because most of those forms are filed on a portal and there is no PDF revision to claim — so what gets verified is that every authority link still goes somewhere. Which is how we found that the EPFO has moved house: our four EPF pages were still pointing at epfindia.gov.in, and the Employees\' Provident Fund Organisation launched epfo.gov.in as its home over a year ago. Those four links now go to the right place.',
    href: '/forms',
  },
  {
    date: '2026-11-23',
    kind: 'improved',
    title: 'The form you are filling in is now the size of a form',
    detail:
      'Fill a PDF form drew the page at 520 pixels wide no matter what you opened it on. A US Letter page at that size is about half life size, so you were reading six-point type on a twenty-seven inch monitor with two thirds of the window sitting empty beside it — and the right-hand column of a W-9 was cut off entirely. It is drawn at about 100% now, and it measures the room it actually has rather than assuming, so it fills a wide screen and still fits a phone.\n\nThe panel of controls beside it got wider too, and became a panel: it used to be a column of loose boxes separated from the document by nothing but a gap, which on a light theme made it look like part of the page you were editing. It now stays put while you scroll a long form. Field names no longer run off the edge of it either — the internal name of a form field can be sixty characters of machine-generated path, and one of them was spilling straight out of the side of the app. It trims now, and hovering shows you the whole thing.',
    href: '/fill-pdf-form',
  },
  {
    date: '2026-11-23',
    kind: 'improved',
    title: 'Something now checks the forms every week, so you don’t have to',
    detail:
      'Every US form page states three things nobody else bothers to state: the revision or edition the agency publishes, how many fillable fields the file really has, and how many pages — each one measured off the agency’s own PDF, on a date we print. That is the whole reason these pages beat a copy somebody uploaded in 2023. It is also a claim with a shelf life, because five agencies revise on their own schedule and none of them sends us a note.\n\nUntil now the only thing keeping it honest was remembering to check by hand. From this week a job reads all thirty forms straight from the IRS, USCIS, the Department of Labor, the VA and Social Security every Monday morning and compares what they say against what we say. If one has moved, we hear about it the same morning, by name, with the old revision and the new one side by side.\n\nNothing about this changes what you get — the blank form has always come live from the agency on every click, so you have never been handed a stale file. What it changes is how long a wrong number can sit on one of our pages: days rather than however long it took somebody to notice.',
    href: '/us-forms',
  },
  {
    date: '2026-11-23',
    kind: 'fixed',
    title: 'The form button now always opens the form you asked for',
    detail:
      'Two ways the “get this form” button could let you down, both reported within the hour, both now fixed. If the page took a while to load — a slow connection, or the first time you had opened the editor — the form was quietly discarded on the way and you arrived at an empty box, having clicked a button that promised you a form. The file was only being held for twelve seconds, counted from before the page had even started moving. It is held for two minutes now, which is long enough for the slowest arrival we could produce.\n\nThe second one was worse, because it looked like it had worked: if you had filled something in earlier, the editor could bring back that older document instead of the form you just asked for. It restores your last file after a moment if nothing else has arrived, and opening a PDF — reading it, drawing it, finding its fields — takes longer than that moment. Handing a form over now holds the restore off, and a form is addressed to the page it was sent to, so it can never be picked up by a different tool you happen to open next.',
    href: '/us-forms',
  },
  {
    date: '2026-11-23',
    kind: 'feature',
    title: 'One click from a form number to the form, filled in your browser',
    detail:
      'The US forms library has gone from twelve forms to thirty — the returns and information returns people actually handle (1040, 1040-X, 1099-NEC, 1099-MISC, W-2, 941, 940), the immigration set (I-9, I-130, I-485, I-765, N-400, I-864), and the forms behind leave, veterans’ claims and a Social Security card (WH-380-E, WH-380-F, WH-381, 21-526EZ, SS-5). That is 4,206 more fillable fields, every one counted off the file the agency was serving on the day we looked, with the edition or revision they publish today printed beside it. Five agencies mark a version five different ways and we use each one’s own word for it — the IRS revises, USCIS publishes editions, and a superseded USCIS edition is not a formatting quibble, it is rejected.\n\nThe part that changes the work, though, is the button. Each page now fetches the blank form from the agency itself and drops it straight into our fill tool — you click once and you are typing. Before, it was three steps and a trip to a government website. We still host none of these: the file comes live from irs.gov or uscis.gov or dol.gov every time, nothing of it is stored on our side, and what you then type into it never leaves your browser — which matters more here than almost anywhere else, since these are the pages where you write down a Social Security number, every account you hold, or your entire immigration history. Several of the USCIS forms arrive encrypted, which used to break the fill tool silently; they open now.\n\nAnd they are findable: press ⌘K and type “w9”, “i485” or “1099” and the form comes up, hyphen or no hyphen. The Tools menu has a row for both form libraries, the fill tool itself points at them for anyone who arrived without the form, and the pages written for immigration, accounting, tax practice and HR each link the forms that trade works out of.',
    href: '/us-forms',
  },
  {
    date: '2026-11-23',
    kind: 'improved',
    title: 'The blank form, if that is all you came for',
    detail:
      'Every US form page now has a quiet second option next to the main button: download the blank form. Same live fetch from the agency, same current revision, it just lands in your downloads folder instead of opening in the editor. Not everybody who needs this year’s W-9 wants to fill it in here, and sending those people off to hunt for the file on irs.gov would be a worse page than one that simply hands it over.\n\nWhile we were at it, the form libraries are reachable from a few more places. The Tools menu has had a row for them; the menu on a phone did not, so on a phone the only route was the footer. Both menus carry it now, along with the bottom of the all-tools page — because someone who has scrolled a hundred and nineteen tools without finding what they want is usually holding a particular document rather than looking for a verb.',
    href: '/us-forms',
  },
  {
    date: '2026-11-23',
    kind: 'improved',
    title: 'Saying plainly who we are not',
    detail:
      'Quite a few pages here name somebody else. The pages written for a trade cite the actual rule that trade works under; the bank pages name banks; the forms libraries name the IRS and the Indian tax authorities; the passport pages quote a government’s own photo specification. Every one of those names is there to describe what a tool does — this is the statement format we read, this is the size that office asks for — and none of them means we have any relationship with anyone. The bank pages and the forms libraries already said so. The trade pages and the passport pages did not, which is how this sort of thing drifts: nobody is against the sentence, it just does not get written on the next batch. They all carry it now, from one place rather than four, and it says three things instead of one: that we are not affiliated with, endorsed by or connected to whoever is named; why their name is on the page at all; and what we actually are, which is a set of general-purpose document tools that happen to suit the work, with the page there to say which of them apply. A test now lists every page that has to carry it.',
    href: '/for/legal',
  },
  {
    date: '2026-11-23',
    kind: 'new',
    title: 'Twelve US tax forms, with the revision we actually checked',
    detail:
      'W-9, W-4, W-7, SS-4, 2848, 8821, 8822, 4506-T, SS-8, 433-A, 433-F and 9465 — 1,480 fillable fields between them. Each page says what the form is, who files it, and the mistake that costs people the most, and then shows three numbers: the revision the IRS publishes today, how many fillable fields the file actually has, and how many pages, each measured off the file the IRS was serving on the day we checked, with that date printed next to it. A script re-checks all three against the IRS directly, so when a form is revised the page stops agreeing with itself instead of quietly going stale. Two of the twelve came back with something worth knowing: the IRS has renamed 9465 to Payment Plan Request in its December 2026 revision while its own “About Form 9465” page still says Installment Agreement Request, and neither 433 has an About page at all, so those two link to the IRS forms index and say so. We do not host any of these. A federal form revised without notice and served stale from our domain would be worse than no copy, because it would look current — you download it from the agency, and fill it here, where a Social Security number or a list of every account you own is typed into a page that makes no network call.',
    href: '/us-forms',
  },
  {
    date: '2026-11-23',
    kind: 'fixed',
    title: 'The forms that quietly refused to merge',
    detail:
      'Open I-130, I-485, I-765 or N-400 — four of the most-filed immigration forms — and nothing asks you for a password. They are encrypted anyway, with an empty one: a wrapper the publisher adds to mark the file read-only. Our page tools took that wrapper at face value and stopped dead. Rotate, merge, split, delete and reorder pages, page numbers, Bates numbering, watermark, pages-per-sheet and flatten all failed on those files, and the form filler was worse — it reported no fields at all on I-485, a form that has 730 of them, so it looked like a form you simply could not fill rather than a file we could not open. All ten work now, on all four. We already ship the piece that removes the wrapper — it is what Unlock PDF runs — so the fix was to run it first, in your browser, before the file reaches anything else: nothing is uploaded, and the copy on your disk is never touched. Files that genuinely prompt you for a password were never part of this and still go through Unlock PDF first.',
    href: '/fill-pdf-form',
  },
  {
    date: '2026-11-23',
    kind: 'new',
    title: 'Four more trades, including one where we argue the opposite',
    detail:
      'Pages for immigration advisers, journalists, insurance and claims teams, and construction and tender teams — thirteen in all now. Each of the first three names the specific rule the reader works under, read at the source rather than from memory: 8 CFR § 208.6, the regulation governing who may see an asylum file; the Privacy Protection Act and the gag provision of the Stored Communications Act, which together explain why a document in your own possession sits differently from one on a company’s server; and the state adoption of the NAIC insurance model law, which puts the duty on your choice of third party rather than on the third party. The construction page is the odd one out on purpose. There is no personal-data duty sitting over a drawing set, so instead of inventing one to make the page match, it says in the same position where the others cite a statute that it is not making a compliance argument, and sells on what is actually true: portal size caps, printing to scale, and splitting double-wide scans.',
    href: '/for/immigration',
  },
  {
    date: '2026-11-21',
    kind: 'fixed',
    title: 'Twelve security advisories closed, and the reason nobody saw them',
    detail:
      'Twelve open advisories across the repo are now zero. None of them could ever have reached you — every one was in development tooling, the test runners and linters that never leave our machines, which is also why our build gate was built to ignore them on purpose: failing a build on a dev-only advisory just teaches people to skip the step. The part worth owning is why nine of the twelve, including both of the serious ones, had piled up in the same corner: our developer SDK was missing from the list of folders the update bot watches. Parked is not the same as finished. The bot watches it now.',
    href: '/security',
  },
  {
    date: '2026-11-21',
    kind: 'improved',
    title: 'Qatar now says we could not check it',
    detail:
      'Every other country on the passport photo tool has been read at its own government source. Qatar has not — the Ministry of Interior portal publishes no photo page and the Hukoomi services site returns an error on every URL we have tried, over several days. The 35×45 mm on white we show is the regional convention, which is almost certainly right, but it is a convention and not something we have watched Qatar state. The page says exactly that now, instead of sitting there looking as settled as the twenty-five we did verify.',
    href: '/passport-photo',
  },
  {
    date: '2026-11-21',
    kind: 'fixed',
    title: 'Bangladesh and Nepal never wanted a photo either',
    detail:
      'Two more countries join the list that photograph you at the counter. Bangladesh says it outright in instruction 3 of its e-passport guidance — no photograph is attached to the form and none needs attesting — and the only photo it asks for anywhere is for a child under six: a 3R lab print on a **grey** background. We had Bangladesh down as 45×55 mm on white, which was neither the right size nor the right colour for the one photo that is actually wanted. Nepal lists “live enrolment — taking photograph and providing biometric information” as step three of your appointment, and publishes no specification at all, because it never receives one. Pakistan does take an uploaded photo, at 35×45 mm on white, with a **20 KB** file ceiling that is the tightest of any country we have read.',
    href: '/passport-photo',
  },
  {
    date: '2026-11-21',
    kind: 'improved',
    title: 'The photo tool now admits when it cannot hit a file limit',
    detail:
      'Pakistan’s 20 KB cap turned up a bug worth owning: the encoder stopped searching at JPEG quality 40, and if that was still over the country’s limit it handed the file back anyway and labelled it “meets Pakistan”. It now searches the full usable quality range, and on the rare crop that genuinely cannot fit, it says so in plain words and suggests what to change rather than claiming a pass. Also, Pakistan’s own guidance asks for a professional photo that has not been edited in other software — we are other software, so the page now says that too, and tells you to use the tool to check the crop and the file size rather than to manufacture the photo.',
    href: '/passport-photo',
  },
  {
    date: '2026-11-20',
    kind: 'fixed',
    title: 'Kenya, South Africa and Korea were cropping too tight',
    detail:
      'Three more head-size ceilings sat above what the authority actually allows, which is the error that bites — too strict is an annoyance, too generous hands you a photo we call correct and the counter refuses. Kenya asks for 5.5 × 5.5 cm with the face at 70–80%; we had a 2×2 inch square, the American size, which looks close enough to pass and is not. South Africa publishes a 29–34 mm head on light grey or cream, not white. Korea sets 32–36 mm and a 413 × 531 pixel file for the online application. All three now match their source, and Korea, Vietnam, South Africa, Türkiye and Kenya carry the full written rule.',
    href: '/passport-photo',
  },
  {
    date: '2026-11-20',
    kind: 'improved',
    title: 'Three more countries that will not take your photo',
    detail:
      'Sri Lanka has not accepted a printed passport photograph since 2015 — the digital photo has to come from a studio the Department has authorised, which uploads it directly and gives you a note to hand in, so there is nothing to print. Thailand photographs you at the counter along with your fingerprints and your height. Nigeria is a hybrid: you upload a photo to the portal, then attend an office for biometrics. Türkiye takes a supplied photo but is the only authority we have read that tells you what to say to the photographer — do not let them cut it to 35 × 45 mm, because 50 × 60 is the Turkish size and the wrong one gets the card cancelled at quality control. Each of these now says so on its page before you spend time on a crop that cannot be used.',
    href: '/passport-photo',
  },
  {
    date: '2026-11-20',
    kind: 'fixed',
    title: 'Colombia was the wrong size',
    detail:
      'We had Colombia down as 35×45 mm. Resolución 10829 de 2024 asks for four by five centimetres — 40×50 mm — which is neither the European size nor the American square, so a photo made here was the wrong shape rather than merely the wrong crop. It is an easy one to get wrong, because almost every neighbouring country uses something else. Now corrected, along with the rest of what the resolution sets out: white background, taken within six months, face in the foreground, frontal and neutral, eyes clearly visible with no glare if you wear glasses, and nothing covering the face. We could not read that resolution ourselves — the ministry’s site turns away automated readers, and we do not work around that — so this one was checked by hand.',
    href: '/passport-photo',
  },
  {
    date: '2026-11-19',
    kind: 'fixed',
    title: 'New Zealand does not want a white background',
    detail:
      'We had New Zealand down as white. Internal Affairs asks for a plain, light-coloured background that contrasts strongly with your face, and its application form says outright that it must not be white — so we were steering people toward the one colour the form rules out. Corrected, along with the rest of what the DIA actually publishes: the digital photo is specified by shape and pixels rather than millimetres, selfies are rejected, a scan of a print is rejected, and filters and AI touch-ups are rejected. Babies get photographed lying on a light sheet from above. Indonesia joins the countries that photograph you at the office, and brings the most easily missed rule we have found so far — no contact lenses, even natural-coloured ones, because immigration treats them as changing the eye. It also asks you not to wear white, since the backdrop there is white.',
    href: '/passport-photo',
  },
  {
    date: '2026-11-19',
    kind: 'fixed',
    title: 'Singapore and Malaysia were cropping too tight',
    detail:
      'Both were wrong, and wrong in the way that costs you the application rather than the printing. Singapore’s own form asks for a face 25 to 35 mm from chin to crown; we were cropping up to 36 mm, past the maximum. Malaysia publishes 30 to 35 mm on its taller 50 mm photo; we were going to 40. Both are corrected to the published figures. Malaysia’s background was wrong too — we had it down as blue, which is an alternative for one kind of visa and not what the Immigration Department asks for otherwise; it is white. Singapore gains the rule people miss, that the background is light grey instead of white if your hair is white, and its upload limit is 8 MB rather than the 1 MB we were enforcing. The Philippines joins the list of countries that photograph you at the counter and would rather you did not bring a print.',
    href: '/passport-photo',
  },
  {
    date: '2026-11-19',
    kind: 'improved',
    title: 'Four countries that do not want your passport photo',
    detail:
      'We read the issuing authority’s own page for Brazil, Mexico, Argentina and Chile — and found that none of them asks you to bring a photograph for a passport. They take it at the appointment. Our pages had been quietly describing prints that nobody had asked for, which is a wasted trip to the photo booth. Each of those four now says so at the top, and says what the tool is still genuinely useful for there: visas and the other paperwork that does ask. Along the way Brazil’s 5×7 cm turned out to apply only to children under five, and Argentina’s photo rule turned out to be written into law — Decreto 749/2019 — including the right to be photographed in a private room by staff of the same sex. Mexico’s is the one to remember if you are going: no glasses, head uncovered. Colombia we could not check, because its ministry blocks automated reading, so we have changed nothing there rather than guess.',
    href: '/passport-photo',
  },
  {
    date: '2026-11-19',
    kind: 'fixed',
    title: 'A way out for phones whose camera preview shows black',
    detail:
      'On a small number of older Android phones the scanner opened on a black rectangle — with the green outline drawn over it, which was the clue: the outline is drawn by code that reads the camera frames directly, so the camera was working and only the picture was missing. Some older graphics hardware does this to video on a web page. The scanner now offers a second way of showing the same picture, drawn frame by frame instead of handed to the phone to display, and on the affected phones it cannot come out black. You will see a small “Picture not showing? Tap to fix” button in the viewfinder; tap it and that phone remembers. Everyone else keeps the normal preview, which is faster and is working fine — and if your first scan comes out cleanly, the question is answered for you and never asked again.',
    href: '/scan-to-pdf',
  },
  {
    date: '2026-11-18',
    kind: 'improved',
    title: 'The scanner clicks when it gets a clean scan',
    detail:
      'Holding a phone over a receipt, you are looking at the receipt, not at the screen — so the scanner now tells you with a sound instead. It makes a camera shutter click the moment it captures a page whose edges it found and straightened. The click is deliberately not given to every shot: press the shutter when no edges have been found and you still get your picture, but in silence, with the reason on screen. So the click means something specific — that one came out clean — rather than simply marking that a button was pressed. It is generated in the browser rather than downloaded, so it costs nothing to load and works offline, and the scanner releases the audio device as soon as you close it.',
    href: '/receipt-scanner',
  },
  {
    date: '2026-11-18',
    kind: 'fixed',
    title: 'The receipt reader was reading your receipt correctly and then throwing the answer away',
    detail:
      'If a scan came back with a wrong total, a store name that looked like typing noise, or a date that was not on the receipt, this was why — and it was not the reader. The reader was getting it right. Our server then failed to understand its reply, discarded the whole thing, and quietly fell back to plain text recognition, which on a photographed till roll can produce nearly anything. The reply is now read properly, so the detailed result comes through: line items, tax lines, the total and what it was paid with. Three things changed behind it as well, all of them about not showing you something we have not actually read. The fallback will no longer put a number in the amount box unless the receipt prints a line that names the total — before, it would take the last price-looking number near the bottom and present it exactly like a figure it had read. A store name now has to contain a real word. And the date box was filling itself in with tomorrow’s date for anyone in the Americas in the evening, because it was using UTC rather than the day you are actually in. A blank box asks you a question; a confident wrong number does not.',
    href: '/receipt-scanner',
  },
  {
    date: '2026-11-18',
    kind: 'fixed',
    title: 'The receipt scanner fills the screen again, and finds the receipt while it does',
    detail:
      'For a short while today the scanner showed the whole camera picture letterboxed — a strip across the middle of the screen with black above and below it, where your phone’s own camera app fills the glass. That was a bad trade made for a good reason, and the reason turned out not to apply. Fitting the picture to the screen does throw away most of it, but on an upright phone it throws it away at the SIDES: every bit of the picture from top to bottom is still there. For a till receipt, which is a tall strip with empty table either side of it, that costs you nothing at all — you do not have to hold the phone any further back than before. What it was costing was the black bands, and the receipt being small enough on screen that the scanner could no longer reliably make out its edges, so the green outline often never appeared however still you held it. The receipt now fills the screen and is found several times more reliably. Full pages still show the whole frame, because a sheet of paper is not a strip and filling the screen really would cut its sides off.',
    href: '/receipt-scanner',
  },
  {
    date: '2026-11-18',
    kind: 'improved',
    title: 'The scanner outlines your receipt in green the moment it finds it',
    detail:
      'The scanner has always drawn a box around what it has found, but it drew it in white and only turned it green at the last moment, once you had held the phone still long enough for it to shoot. That answered the wrong question. The one you are actually asking, while waving a phone over a receipt, is whether it has seen the thing at all — and a white line reads as part of the furniture rather than as an answer. Green now means one thing, this is your receipt, from the moment it finds it; it thickens, glows and washes the receipt in green when it is about to take the shot. The zoom controls also stopped stacking into two rows of nearly identical buttons across the middle of the viewfinder. There is one row, and on a phone with an ultra-wide lens it is the real lens, so 0.5× shows you more of the room rather than simply enlarging the middle of the picture.',
    href: '/receipt-scanner',
  },
  {
    date: '2026-11-18',
    kind: 'fixed',
    title: 'The receipt scanner stopped throwing away most of what the camera could see',
    detail:
      'If you had to hold the phone a long way back to get a whole till receipt on screen, this was why. The scanner opened magnified — not with the lens, but by enlarging the middle of the picture and discarding the rest, which on a typical phone meant about nine tenths of the camera’s view was gone before you pointed it at anything. The only way to make that back up was to move the phone further away, and a receipt photographed from that distance was then too small for the scanner to find its edges, so the green outline would not settle either. Two things fixed it. The camera is now asked for its own natural picture shape instead of a widescreen one — a widescreen frame is a crop of the sensor, so that alone was about a third more view for nothing. And on a phone with an ultra-wide lens the scanner opens on the lens itself and offers 0.5× and 1× the way a camera app does, which fits the same receipt from roughly half the distance. Both give you more of the room; neither costs you any sharpness, because the camera was always able to see that much.',
    href: '/receipt-scanner',
  },
  {
    date: '2026-11-15',
    kind: 'fixed',
    title: 'The search shortcut button can be used by voice, and reads properly aloud',
    detail:
      'The small ⌘K button beside the search box was announced to screen readers as "Open command palette" — words that appear nowhere on it. If you drive your computer by voice, saying "click ⌘K" matched nothing, because the name the computer had for that button was not the name printed on it. It now reads "Open command palette, ⌘K", and says Ctrl K rather than ⌘K when you are not on a Mac. The illustrated browser window on the home page is also no longer read out item by item — a fake address bar and a sample file size are decoration, and a screen reader now gets the name of the tool it links to instead.',
  },
  {
    date: '2026-11-15',
    kind: 'fixed',
    title: 'Rate limits count a visitor, not an address',
    detail:
      'The limits that keep the site standing up — how many sign-in attempts, how many conversions in a quarter of an hour — were counted against the exact address a request arrived from. On IPv6 that barely means anything: a home connection is handed a whole block of addresses and may use a different one for every request, so the limits really only ever applied to people on IPv4. They are now counted against the block a connection belongs to. Nothing changes if you are using the site normally. The same change fixes the opposite case, where one person could be counted twice because two parts of the stack wrote their address down differently.',
  },
  {
    date: '2026-09-19',
    kind: 'improved',
    title: 'The receipt scanner now uses the whole screen, and finds the receipt for you',
    detail:
      'Photographing a receipt happened in a small box inside the page — about a third of a phone screen, with the privacy notice above it and two buttons below. A receipt is the one document shaped so that you need the height. It now opens the same full-screen scanner as Scan to PDF: it finds the edges of the receipt while you hold the camera, draws them in green, and straightens and cuts out the receipt when it takes the shot, so what goes to the reader is the receipt rather than the receipt and your table. It opens filling the screen rather than fitting the camera’s whole frame inside it — most phone cameras hand over a landscape picture whatever the phone is doing, and fitting that into a tall screen left a horizontal band across the middle with black above and below, which is no use at all for something as tall as a receipt. It knows to expect a long thin shape, so a till roll no longer fails the checks written for a sheet of paper. And it captures on its own once the picture is steady. And it says what it is doing in the middle of the screen, where you are actually looking — "Receipt found — hold still", then "Captured" — instead of only in a small line under your thumb.',
    href: '/receipt-scanner',
  },
  {
    date: '2026-09-19',
    kind: 'improved',
    title: 'Crop a scan without opening the preview first',
    detail:
      'Cropping lived only inside Preview, and not everyone opens Preview — plenty of people go straight from the shutter to Save PDF. A page whose edges could not be found is still the whole picture, desk and all, so that page went into the PDF uncropped and nothing had said so. The page list now marks those pages, says how many there are, and has a Crop button on every row that opens straight onto the corner handles. The scanner says it at the moment of the shot too.',
    href: '/scan-to-pdf',
  },
  {
    date: '2026-09-15',
    kind: 'feature',
    title: 'Scanned receipts keep their line items in the budget',
    detail:
      'The receipt scanner reads everything on the paper — every line item, the tax lines, the payment method, the reference numbers — and shows it to you before you save. Saving to the budget then kept only the total, so the same expense opened a week later was a bare number and all of that was gone. It is now stored with the expense: any scanned entry in Budget Tracker has a Receipt button that opens the full breakdown you approved, including the arithmetic check and the CSV download. It opens as a summary line — how many items, and whether the totals add up — and unfolds on a second tap, so opening one receipt does not push the rest of your month off the screen. Expenses you typed in by hand are unchanged, and so is everything logged before today — there was nothing to keep. Card numbers are still stored as the last four digits only.',
    href: '/budget',
  },
  {
    date: '2026-09-15',
    kind: 'improved',
    title: 'Undo a crop and place the corners again',
    detail:
      'Cropping by hand is a judgement, and until now it was one you could not revise — a corner dropped in the wrong place meant scanning the document again. A cropped page now has an Undo crop button in Preview, which puts the whole picture back so you can drag the corners where you actually wanted them. It always returns to the original capture, not to the attempt before, because placing the corners again is the point. It is only offered on a page that has been cropped, and it disappears once there is nothing left to undo.',
    href: '/scan-to-pdf',
  },
  {
    date: '2026-09-15',
    kind: 'fixed',
    title: 'Colour scans come out the right colour',
    detail:
      'Scanning something lit by a screen or a warm lamp came back tinted — a bluish page turned cyan. The cleanup was brightening all three colour channels by the same amount, and that cannot remove a colour cast: it amplifies one. A photo of a screen measured 178 red, 190 green, 206 blue; multiplying all three to bring the page up to white clipped green and blue at the top of the scale and left red trailing, which is a cyan page. Each channel is now balanced against its own background, so whatever the paper was lit by, the three come up to white together and the cast goes with them. Ink and stamps keep their own colour. And the Crop button in Preview now explains itself: when the edges were not found, the page says so and offers cropping as the next step rather than as an unlabelled option.',
    href: '/scan-to-pdf',
  },
  {
    date: '2026-09-15',
    kind: 'feature',
    title: 'Set the corners yourself when the scanner cannot see them',
    detail:
      'A white page on a white bedspread cannot be detected, and it is worth being plain about why: there is no edge there to find. Measured across a real capture, the paper and the quilt under it differ by two or three shades — less than the speckle your camera adds. No scanner can find a boundary that is not in the photograph. So when the outline does not appear, open the page in Preview and press Crop: four dots appear over the picture, you drag them to the corners of your document, and it is straightened and cut out exactly as if the edges had been found on their own. The same perspective correction, the same result. Detection on a dark surface still works as before and is quicker when it does.',
    href: '/scan-to-pdf',
  },
  {
    date: '2026-09-15',
    kind: 'feature',
    title: 'See a scan full size before you save it',
    detail:
      'There is now a Preview button above Save PDF, and tapping any page in the list opens the same thing. It shows the actual page as it will appear in the file — the white A4 sheet, the margin, portrait or landscape chosen exactly the way the PDF chooses it — rather than just the photo, so what you check is what you get. Flick between pages with the arrows or the arrow keys, turn or delete a page without leaving, and press Escape to come back. The thumbnail in the list is about a centimetre wide, which is enough to know a page is there and not enough to tell whether the text came out readable. Colour is now the mode a scan starts in, and switching mode re-does the pages you have already taken instead of only applying to the next one.',
    href: '/scan-to-pdf',
  },
  {
    date: '2026-09-15',
    kind: 'improved',
    title: 'Scans now look scanned, and you can pick the mode',
    detail:
      'A scan of an envelope came out looking like exactly what it was — a photo of an envelope lying on a bed, grey and shadowed. The old cleanup was a single brightness-and-contrast adjustment applied to the whole picture, and that cannot fix a photograph of paper, because the trouble is not the overall level: it is that the level is different in different places. Your phone throws a shadow, a lamp lights one corner, and paper that reads as white at the top of the frame is the same grey as the ink at the bottom. Lift it until the shadowed half goes white and the lit half blows out. The scanner now works out how bright the paper is in each part of the picture and divides that out, so the page comes back evenly white wherever the light was falling, with the text dark and crisp. And there are three modes instead of one tickbox: Colour, which keeps stamps and highlighter and only whitens what is actually paper; Greyscale, which is what most people mean by a scan; and Black & white, for the crispest text and the smallest file.',
    href: '/scan-to-pdf',
  },
  {
    date: '2026-09-14',
    kind: 'fixed',
    title: 'The scanner can see a printed page again',
    detail:
      'A white envelope on a pale bedspread would not be recognised at all — no outline, nothing, however it was held. The cause turned out to have nothing to do with framing or lighting: it was the printing on the envelope. The scanner looks for the sharpest boundaries in the picture and keeps a fixed share of them, and on a document covered in black address lines and a red banner, the ink is far sharper than the edge of the paper itself. White paper on a cream quilt is a difference of about thirty shades; the print used up the whole budget and the edge of the page fell below the line. The scanner was going blind on documents precisely because they had writing on them. It now looks again, more sensitively, when the first pass finds nothing — and anything that only turns up on the second look has to prove itself against a higher bar before an outline is drawn around it.',
    href: '/scan-to-pdf',
  },
  {
    date: '2026-09-14',
    kind: 'improved',
    title: 'The scanner stops outlining things that are not your document',
    detail:
      'Hold the phone too close and your page runs off the sides of the picture. The scanner needs all four corners to work out where a page is, and it had two — so it either found nothing, or worse, drew a confident green outline across a wedge of the page and captured that. Several of those could pile up in the page list before you noticed. An outline whose corner sits on the very edge of the picture is now refused outright: that is not a corner of your document, it is the point where your document left the frame. And instead of repeating “Point the camera at your document” to someone doing exactly that, it now says “Move back — the page runs off the edge”, which is the thing that fixes it. If nothing is found for a few seconds it suggests the next most likely cause: get all four corners in, and put the page on something that is not the same colour as the page.',
    href: '/scan-to-pdf',
  },
  {
    date: '2026-09-13',
    kind: 'fixed',
    title: 'Turn your phone sideways and the scanner comes with you',
    detail:
      'Three separate things stopped the scanner working in landscape. If you had added DiemDesk to your home screen, the app was locked to upright — turning the phone did nothing at all, anywhere in DiemDesk. That lock is gone. Then the scanner would turn, but the picture would not: the camera was still taking the tall picture it had been asked for when the scanner opened, and a tall picture shown on a wide screen is a narrow strip down the middle, which looks exactly like nothing having turned at all. The camera is now asked to re-shoot the way you are holding the phone, so the picture turns with the screen. And how far the picture could be zoomed was worked out once when the scanner opened and then kept, even though turning the phone changes it completely: filling an upright screen with a wide camera takes a 3.8× zoom, and filling the same screen on its side takes 1.2×. The zoom stops are rebuilt when you turn, and the edge detection re-frames with them. The controls also take up less room on a screen that is short and wide, so the page is not buried under them.',
    href: '/scan-to-pdf',
  },
  {
    date: '2026-09-13',
    kind: 'fixed',
    title: 'DiemDesk now tells you when there is a newer version',
    detail:
      'If you kept a DiemDesk tab open, your browser could go on running an older copy of the site for days — so fixes that were live on our end simply never reached you, with nothing on screen to say so. A small bar now appears at the top when a newer version has downloaded and is waiting, with a Reload button that switches to it. Nothing swaps underneath you while you are in the middle of something: the page only changes when you tap it. You can dismiss the bar and carry on, and the new version will be picked up next time you open the site anyway.',
  },
  {
    date: '2026-09-13',
    kind: 'feature',
    title: 'Zoom in the scanner, like the one in your camera app',
    detail:
      'Some phones hand the browser a wide, cinema-shaped picture even when you are holding them upright. Filling the screen with one of those means cutting off about three quarters of what the camera can see — which is why the scanner looked zoomed in from the moment it opened, on some phones and not others. There is now a row of zoom stops above the shutter, the way your camera app has them. 1× is everything the camera can see, with black bars above and below; the last stop fills the screen. It opens at 1× — zoomed right out, so you can see the whole page and zoom in if you want to, rather than opening too close with nothing on screen to tell you why. The edge detection follows whatever you pick, and what you save is what you framed. If your camera happens to match the shape of your screen, the stops do not appear at all — there would be nothing for them to change.',
    href: '/scan-to-pdf',
  },
  {
    date: '2026-09-13',
    kind: 'fixed',
    title: 'The scanner picture stays put unless you move the phone',
    detail:
      'The camera could open upside down, and the picture could shift or rescale while the phone had not moved at all. Both came from this app trying to help. There was a rotate button, and whatever you last set it to was remembered — so one press while trying to fix something else left the scanner opening turned on every visit afterwards. And the preview was being given a size measured in code, which changes every time a phone’s address bar slides away, moving the picture with it. Neither is there now. The camera is shown exactly as your browser gives it, sized by nothing but the screen, so it reacts when you turn the phone and at no other time. Any rotation you had saved is cleared the next time you open it. If a scan does come out the wrong way round, there is now a turn button on each captured page in the list beside the scanner — where the picture is still and you can see what the tap did. The scanner also stops asking your camera for a wide, cinema-shaped picture when you are holding the phone upright: it asks for one shaped like your screen, so less of what the camera can see is cut off at the sides.',
    href: '/scan-to-pdf',
  },
  {
    date: '2026-09-13',
    kind: 'fixed',
    title: 'The scanner outline holds still, and only appears when it should',
    detail:
      'The outline round your page shimmered and jumped about — it was being worked out from scratch on every frame, and a camera’s picture is never quite identical twice, so a page sitting perfectly still still looked like it was being redrawn constantly. It is now averaged over several frames, and it rides out the odd frame where the camera loses the page rather than blinking off and on. Pointing the camera at a bare desk could also produce a confident green rectangle round nothing at all: the edge of the picture is a perfect rectangle, so it passed every shape test better than a real page does. The scanner now checks there is an actual edge there before it believes it. The “Scan document” label has stopped sitting on screen permanently — it appears when a page has been found, so it tells you something instead of just being there. And nothing rotates the picture by itself any more, in either direction: the camera shows exactly what your browser gives it.',
    href: '/scan-to-pdf',
  },
  {
    date: '2026-09-12',
    kind: 'fixed',
    title: 'The scanner viewfinder now behaves like your phone camera',
    detail:
      'On some phones the scanner opened sideways, or in a band across the middle of the screen, or zoomed so far in that the page would not fit. The preview was being redrawn by hand, and which way up a camera picture arrives differs between phones and browsers, so the guess was wrong as often as it was right. The camera now shows through directly, the way it does in your phone’s own camera app: the right way up, and moving at the camera’s own speed rather than in steps. The outline it draws around the page sits exactly on the page, because what you see and what it saves are now the same picture. (How much of the screen the picture fills became your choice a day later — see the zoom stops above.)',
    href: '/scan-to-pdf',
  },
  {
    date: '2026-09-12',
    kind: 'feature',
    title: 'Scan to PDF is a real document scanner now',
    detail:
      'Tap Open scanner and the camera takes over the whole screen. Point it at a page and it finds the edges of the document itself, draws a green outline around it and dims the desk around it, so you can see exactly what it has got. Hold still for a moment and it takes the shot on its own — then waits for the next page rather than firing again at the one you are still holding. What it saves is the document, not the photograph: the page is straightened out of whatever angle you held the phone at and everything around it is cut away, so a sheet photographed askew on a kitchen table comes out as a clean rectangular page. There is still a shutter button if you would rather take it yourself, and a switch to turn the automatic capture off. All of it runs on your device — the camera never leaves your browser.',
    href: '/scan-to-pdf',
  },
  {
    date: '2026-09-10',
    kind: 'improved',
    title: 'Scan to PDF: a viewfinder you can actually aim',
    detail:
      'On a phone the camera preview was a squat little strip. The app asked the camera for a wide, landscape picture even though you were holding the phone upright, so what you were photographing ended up postage-stamp sized between two black bars. It now asks for a picture shaped like your screen and the preview is about three times bigger. Taking a page also tells you it worked: the screen flashes, the phone gives a short buzz, and “Page 1 captured” appears across the top with a thumbnail of what you just took and a running count beside the shutter. Before, the only evidence was a list further down the page you had to go and find. And if you press the button before the camera has warmed up, it now says so instead of doing nothing at all.',
    href: '/scan-to-pdf',
  },
  {
    date: '2026-09-07',
    kind: 'fixed',
    title: 'Printing works again in Safari',
    detail:
      "Printing a finished PDF did nothing in Safari, on Mac and on iPhone. A security rule that stops other websites embedding DiemDesk was also, only in Safari, stopping DiemDesk from opening its own freshly-made file to print it. Other browsers were never affected, which is why it went unnoticed. The rule still refuses every outside site; it now makes an exception for us opening our own work. Folder Preview, which shows each file in a folder the same way, was blank in Safari for the same reason and is fixed with it.",
  },
  {
    date: '2026-09-07',
    kind: 'fixed',
    title: 'Two things a phone was hiding',
    detail:
      "On a phone, the privacy notice at the bottom of the screen sat on top of the last part of the page, so whatever was down there could be read but not tapped — the same complaint as the download button on the favicon pack. Separately, after moving files to the bin in Folder Preview, the Undo button appeared behind the bottom navigation bar and could not be pressed. Both were the same mistake: two things pinned to the bottom of the screen, each unaware of the other. The page now leaves room for whichever is taller.",
  },
  {
    date: '2026-08-30',
    kind: 'feature',
    title: 'DiemDesk now works inside Claude',
    detail:
      "Ask Claude to convert a file and it just happens — to a real file on your own machine, no browser, no upload dialog. One line to set up: `claude mcp add diemdesk -- npx -y diemdesk-mcp`, or a small block in Claude Desktop's config. Nine tools are exposed: the Office and PDF conversions, PDF/A, OCR, and capturing a live web page. Deliberately not all of them — most DiemDesk tools run inside your browser and never touch a server, so putting them here would mean uploading files to do work your own machine already does privately. The setup page has the config for both apps, the token step for Pro, and what to do when the tools do not show up.",
    href: '/mcp-server'
  },
  {
    date: '2026-08-29',
    kind: 'fixed',
    title: 'Opening a file from the bottom bar now shows you it is working',
    detail:
      "Picking a file with the bottom bar now tells you what is happening. It used to work silently: the file was handed to the right tool, but the page kept the scroll position you had on the way in, so the tool was often off-screen and it looked like nothing had happened at all — and the natural response, refreshing, threw the file away. Now a line appears the moment the picker closes saying which file is opening and which tool it is going to, the page scrolls up so the tool is actually in front of you, and the message clears itself once the file has landed. If the handover cannot be completed for any reason, it says so and tells you to pick the file again on the page you are already on, instead of leaving you guessing.",
    href: '/'
  },
  {
    date: '2026-08-29',
    kind: 'fixed',
    title: 'The app bar carries your file with it, and you can pin your favourite tools',
    detail:
      "Two things on the bottom bar. The centre button now actually carries your file across: picking one used to take you to the right tool and then leave you staring at an empty picker, which looked like it had worked and had not. The file now arrives with you, already loaded. And you can pin the tools you use most — press and hold any tool in the Recent sheet and it moves up into a Pinned row that stays put. Recents tell you what you touched yesterday; pins are for the four or five things that are the reason you come here at all, and those should not get buried under whatever you happened to open last. Press and hold again to unpin. Pins live on your own device, not in an account, so they work whether or not you are signed in.",
    href: '/'
  },
  {
    date: '2026-08-29',
    kind: 'feature',
    title: 'A proper app bar at the bottom of the screen on phones',
    detail:
      "On a phone there is now a bar along the bottom, the way an app has one. Home, Tools, Recent and your account sit in the corners, and the middle is a raised button that opens a file from wherever you are. That last one is the point: until now, starting a different job meant scrolling back to the top of the page and opening the menu in the far corner, which is the one place a thumb cannot reach. Pick a file and it takes you to the tool that suits it rather than to a page that asks what you wanted — a HEIC goes to the converter, a spreadsheet goes to Excel to PDF, a PDF opens in the viewer. Recent slides up a sheet of the tools you have used, so getting back to something takes one tap. It appears on phones only; the desktop header already has all of this, and two navigations at once looks like a website pretending to be an app.",
    href: '/'
  },
  {
    date: '2026-08-29',
    kind: 'new',
    title: 'DiemDesk works inside Claude and other AI assistants',
    detail:
      "You can now use DiemDesk from inside Claude, or any assistant that speaks MCP. Point it at the server and ask it to convert a Word file to PDF, turn a PDF back into an editable document, OCR a scan, or capture a live web page — it does the job and writes the file next to the original. There are nine tools rather than a hundred and fourteen, and the reason is the same reason the site exists: almost everything here runs inside your browser and never sends the file anywhere, and an assistant running on your behalf simply cannot reach those. We were not going to build server versions of them purely to make the list longer, because that would mean uploading files that currently never move. So what is exposed is exactly the set that already ran on our servers — the Office conversions, OCR and webpage capture — behaving the same way they always did. Ask the assistant to run list_local_tools and it will tell you which jobs to do on the website instead, and why.",
    href: '/mcp-server'
  },
  {
    date: '2026-08-29',
    kind: 'fixed',
    title: 'The receipt scanner now reads receipts that are sideways, and stops guessing the amount',
    detail:
      "The receipt scanner was getting real receipts wrong, and there were three separate reasons. It now rotates the photo the right way up before reading it — a till roll is long and thin so people photograph it sideways, and reading a sideways receipt does not produce a worse answer, it produces noise, which is why a Walmart receipt came back with a store name of \"Aeqg AJeAFq 1SnN4\" and no amount at all. The amount is worked out properly now instead of being guessed: it looks for the line that says total, ignores the card-machine block at the bottom that says TOTAL PURCHASE once per tender, and where the receipt prints a subtotal and a tax line it checks that the total actually adds up. If it still cannot tell, it leaves the box empty rather than filling it in, because a wrong number gets saved to your budget while an empty one gets typed in correctly. It used to fall back to the largest number anywhere on the receipt, which is usually the phone number. Two buttons were broken too: Use camera opened the camera but showed you a black rectangle, and Upload photo opened the camera as well, so there was no way to pick a receipt already saved on your phone. Both work now.",
    href: '/receipt-scanner'
  },
  {
    date: '2026-08-29',
    kind: 'feature',
    title: 'Tool pages now suggest what usually comes next',
    detail:
      "Tool pages now tell you the step that usually comes after the one you just did, and why it follows. Compress a PDF and it points at the Share-Safe check, because you compressed it in order to send it and you should know what is hidden inside it first. Sign one and it offers to flatten it, so the signature cannot be dragged off the page afterwards. Scan a document and it offers OCR, because a photo of text is not text. It only appears where a step genuinely follows — on a tool where nothing does, there is nothing there, which is deliberate. This is the idea we picked over showing your recently used tools: recency only tells you what you already know you opened, and shows a first-time visitor nothing at all, while the next step is the same for everyone and works the first time you land here from a search.",
    href: '/compress-pdf'
  },
  {
    date: '2026-08-29',
    kind: 'improved',
    title: 'Aadhaar, company, GST registration and banking forms added',
    detail:
      "Eleven more, taking the library to 32. Aadhaar enrolment and update, the MCA company filings (SPICe+, DIR-3 KYC, AOC-4, MGT-7), GST registration, the banking declarations (KYC update, FATCA/CRS, nomination) and Form 15CA for foreign remittances. Same as the first batch: what it is, who files it, roughly when, and the thing people get wrong — which for these is often the expensive part. Miss DIR-3 KYC and your DIN is deactivated, which blocks every filing that needs your signature, and you find out on the day something is urgent. A bank nominee is a receiver, not an heir: the money is paid to them, but who is legally entitled is decided by succession law, and families assume the nomination settles it. Certain Aadhaar fields can only be changed a limited number of times in a lifetime, so a small correction can burn the attempt you needed for a real one.",
    href: '/india-forms'
  },
  {
    date: '2026-08-29',
    kind: 'new',
    title: 'DPA, subprocessors, accessibility and security reporting',
    detail:
      "Four pages that business buyers ask for before they are allowed to pay, published rather than sent on request. A Data Processing Agreement setting out our GDPR Article 28 processor terms — and the table in it is the point, because for most of the catalogue the honest answer to \"what do you hold?\" is nothing at all. A subprocessor list naming everyone outside DiemDesk who can touch personal data: there are four, and the page says plainly that the list is short for a structural reason rather than a modest one, since tools that never receive a file cannot hand it on. An accessibility statement that does not claim a conformance level we have not been audited against, and instead lists the gaps we already know about, including that drag-and-drop in the visual editors is not solved. And a vulnerability disclosure policy with a safe-harbour commitment, response times we will actually meet, and a machine-readable security.txt. The report we most want is named on it: evidence that an in-browser tool sends file content anywhere.",
    href: '/dpa'
  },
  {
    date: '2026-08-29',
    kind: 'new',
    title: 'Indian tax, GST and EPF forms explained',
    detail:
      "A plain-English guide to 21 Indian forms: Form 16, Form 16A, 26AS, AIS, all four ITR forms, 15G and 15H, 10E, 12BB, the PAN forms 49A and 49AA, GSTR-1, 3B and 9, and the EPF claim forms 19, 10C, 31 and 13. Each page says what the form is, who files it, roughly when, and — the part nobody writes down — the specific thing people get wrong. Two Form 16s from two employers in one year, and the second employer knowing nothing about the first. Taking the EPF withdrawal benefit when a scheme certificate would have kept your pension service. Claiming arrears relief without filing 10E first, so the relief is reversed. We do not host any of the forms. Government forms get revised without notice and a stale copy served from here would be worse than none, so every page links to the department that issues it. We also do not file anything for you — what these tools do is the paperwork around the filing, which is where the real friction is: combining certificates, squeezing a scan under a payroll portal upload cap, turning a statement into rows that add up.",
    href: '/india-forms'
  },
  {
    date: '2026-08-29',
    kind: 'improved',
    title: 'Pages for finance, public sector and property — and all of them findable',
    detail:
      "Three more pages for people whose work makes uploading a document a problem, and — more usefully — all nine of them are now findable. The sector pages and the newer comparison pages were live and in the sitemap but linked from nowhere on the site, so unless you knew the address you were never going to see them. Both lists are now built from the same data the pages are, so adding one adds its link. The new pages: lenders and finance firms, where the FTC Safeguards Rule reaches far past banks and names mortgage brokers, collection agencies and tax preparers by example; public sector teams redacting records before a FOIA release, where a black rectangle over text that is still underneath is the failure everyone has read about; and property firms, where a completion file is an ID document, a bank statement and a set of account details moving between parties on a deadline — the FBI logged .77bn of business email compromise losses in 2024.",
    href: '/for/finance'
  },
  {
    date: '2026-08-29',
    kind: 'improved',
    title: 'Bank statement guides for 39 banks, up from 11',
    detail:
      "The statement converter now has a guide for 39 banks instead of 11. New ones cover IndusInd, Federal, RBL, Bandhan, AU Small Finance, IDBI, Central Bank, Indian Bank, UCO, South Indian, Karnataka, CSB, DCB, Bank of India, IOB, Punjab & Sind, Standard Chartered and HSBC, plus Fi and Jupiter, the credit card statements from HDFC, SBI Card, ICICI, Axis and Amex, and three things that are not bank statements but get converted for the same reason: Razorpay settlements, a Zerodha ledger and PhonePe history. Each page tells you where that particular portal hides the download, what its password is usually built from, and the specific thing about its layout that trips converters up. The credit card pages say plainly that the balance check works differently there, because a card statement has no running balance to check against — we total the transactions against the opening balance, payments and closing amount due instead. Two banks were deliberately left out: Paytm Payments Bank, whose licence the RBI cancelled in April, and Citi India, whose accounts moved to Axis.",
    href: '/bank-statement-converter'
  },
  {
    date: '2026-08-29',
    kind: 'improved',
    title: 'Every tool card now tells you what the tool does',
    detail:
      "Every tool card now says what the tool actually does. Sixty-seven of our 114 tools had no description at all — the card was a name and nothing else — and most of the ones that did have a line just said the name again in different words: \"Word into a PDF\" under Word to PDF, \"Slides into a PDF\" under PowerPoint to PDF. All 114 are rewritten to answer the question you were actually asking. Nobody converting a Word file is unsure what that means; they are wondering whether the table survives, so it now says fonts, tables and layout land where you left them. Rotate says the fix survives saving, because that is the thing that goes wrong. Repair says it opens files other readers refuse. And the little crossed-out cloud in the corner of each card, which was carrying our whole argument and asking you to guess what it meant, is now just written down: Runs in your browser, or Processed on our servers, whichever is true for that tool.",
    href: '/'
  },
  {
    date: '2026-08-29',
    kind: 'improved',
    title: 'Pages for HR teams and tax practitioners',
    detail:
      "Two more pages for people whose job makes uploading a document a problem, joining the existing ones for legal, accountants, healthcare and schools. The HR page is about the thing HR inboxes are full of and nobody says out loud: sickness notes, grievances naming beliefs, right-to-work documents. Those are special-category data under GDPR Article 9, prohibited to process by default, and the page quotes the security wording from Article 5 rather than gesturing at it. The tax practitioners page quotes IRS Publication 4557, which says protecting taxpayer data is the law and that preparers must write and enact a security plan under the FTC Safeguards Rule. Both pages list what we cannot do as clearly as what we can — we are not an HR system, we do not file returns, and we keep no audit trail of what you processed, which is the point and also a limitation.",
    href: '/for/hr',
  },
  {
    date: '2026-08-29',
    kind: 'improved',
    title: 'Five more honest comparisons: PDF24, Foxit, Soda PDF, pdfFiller and pdf.net',
    detail:
      "If you are weighing us up against something else, there are now nine comparison pages instead of four. The new ones cover PDF24, Foxit, Soda PDF, pdfFiller and pdf.net, and they are written the same way as the others: what the other product genuinely does better goes on the page, in plain words, next to what we do better. PDF24 is free and broad and says so honestly — but it uploads your file unless you install its Windows app, which is not an option on a Mac or a locked-down work laptop. Foxit is a serious desktop editor, and if you do production PDF work every day it earns its licence fee; if you merge and sign a few files a month it does not. pdfFiller is built for teams routing paperwork for signature, which we do not do at all. pdf.net has a large US tax and immigration forms library and seven languages, and we have neither. Every competitor figure on these pages was read from their own site, and the page links to it so you can check.",
    href: '/compare',
  },
  {
    date: '2026-08-29',
    kind: 'improved',
    title: 'Passport photo pages now say what each country actually asks for',
    detail:
      'Thirty-odd countries publish the same 35 \u00D7 45 mm photo, so our pages for them were saying much the same thing in much the same order \u2014 useful once, tedious by the third country, and not much help if your question was \u201Cwill Australia take this?\u201D The UK, Canada and Australia pages now carry the rules from the issuing authority itself: who issues them, whether glasses are allowed at all, when a head covering is accepted, how old the photograph may be, what changes for children, and the one thing people most often get wrong. Two of those turned out to matter more than the measurements. Canada refuses edited photographs and counts cropping and background replacement as editing, and Australia refuses retouching \u2014 so both pages now say plainly what this tool should and should not be used for there. Australia also warns against online photo services on identity-fraud grounds, which is a fair warning about anything that uploads your face to a server; your photo never leaves your browser here, and the page says so rather than skipping the question. Three specs were corrected along the way: the UK head height is 29\u201334 mm and the background is cream or light grey rather than white, and Australia publishes a size range with the face at 32\u201336 mm.',
    href: '/passport-photo/uk-passport',
  },
  {
    date: '2026-08-29',
    kind: 'fixed',
    title: 'You can sign, stamp and annotate a PDF with a photo from your phone',
    detail:
      'The tools that put a picture into a PDF — Sign, Watermark, Annotate, Edit and the signature maker — were the last holdouts still asking for a PNG or a JPG. So the obvious thing, photographing your signature on a piece of paper and uploading it, did not work from an iPhone, because an iPhone saves that photo as a HEIC. The file picker greyed it out and there was nothing on screen explaining why. All five now take any photo your phone produces, HEIC included, along with WebP, GIF, BMP, TIFF and AVIF. A signature with a transparent background stays transparent — we keep the see-through parts rather than flattening them onto a white box, which is the whole reason people export a signature as a PNG in the first place. If a picture genuinely cannot be opened, the message now says what the file turned out to be instead of just refusing.',
    href: '/sign-pdf',
  },
  {
    date: '2026-08-29',
    kind: 'fixed',
    title: 'iPhone photos now work in every image tool, not just some of them',
    detail:
      'An iPhone saves photos as HEIC, and until now most of our image tools quietly refused them. Compress, Convert, Crop, Resize, Remove background, the passport photo maker, the EXIF cleaner and the QR reader would either grey the photo out in the file picker or accept it and then say it could not be read — and one of them helpfully suggested you go and convert it with our own HEIC to JPG tool first, which is a strange thing for us to ask when we already had the decoder sitting there. Worse on Android, where the phone hands over a HEIC photo labelled as a JPG: the file went through, then failed. All of those tools now open an iPhone photo directly. PowerPoint show files (.ppsx and .pps) convert too — they always could, they were just missing from the list of things we said we accepted.',
    href: '/compress-image',
  },
  {
    date: '2026-08-29',
    kind: 'improved',
    title: 'Every page now has a plain-text version, for people and for AI assistants',
    detail:
      'More and more people find a tool by asking an assistant rather than by searching, and an assistant landing on an ordinary web page has to pick three useful sentences out of a wall of markup. So every page on the site now also exists as plain text: add .md to any address — diemdesk.com/compress-pdf.md, or /passport-photo/japan.md — and you get the same content with nothing but words in it. There is also an index at diemdesk.com/llms.txt listing all 176 pages with what each one does, whether it runs in your browser or on our servers, and whether it is free. Useful if you want to read a page without the page, paste one into something, or point your own assistant at the right tool. The text is generated from the published page every time we deploy, so it cannot quietly drift out of date with what the page actually says.',
    href: '/llms.txt',
  },
  {
    date: '2026-08-28',
    kind: 'fixed',
    title: 'Webpage to PDF stopped giving up on busy pages — and now tells you what it is doing',
    detail:
      'It used to wait for a page to go completely quiet before capturing it. That sounds sensible and is wrong for most real sites: anything with analytics, a chat widget, a live feed or a running clock never goes quiet, so pages that were perfectly ready to capture were told they had "taken too long to load". Now it waits for the page itself, gives the images and fonts a few seconds to catch up, and prints what is there. A page you can see is a page it can print. The button also stops saying one thing for half a minute — it now names the step it is on, from checking the address through starting the browser to printing, so a slow capture looks like work rather than a hang. The honest bit: the first capture after a quiet spell is the slow one, because the browser has to start up, and now you can see that is what it is doing.',
    href: '/webpage-to-pdf',
  },
  {
    date: '2026-08-28',
    kind: 'fixed',
    title: 'Pro accounts were being counted as free on the server tools',
    detail:
      'Word, Excel, PowerPoint and HTML to PDF, PDF to Word, and Webpage to PDF were not telling the server who was asking, so a Pro subscriber was metered like an anonymous visitor and stopped after three conversions a day — on exactly the tools whose pages promise unlimited. Nobody was charged for anything they did not get, and nothing was lost; the cap simply applied to people it should never have applied to. Fixed on all of them, with a check that now fails the build if a server tool ever forgets again.',
    href: '/pricing',
  },
  {
    date: '2026-08-27',
    kind: 'new',
    title: 'OCR is open — read the text off a scan',
    detail:
      'Point it at a scanned PDF or a photo of a page and you get the document back with real, selectable, searchable text underneath — the pages look exactly as they did, and the file barely grows, because we lay an invisible text layer over your originals rather than re-rendering them. Over fifty languages, and you can pick a page range. This one is Pro: it is the single job here that cannot run inside your browser, so it runs on our server and takes real time per page, which is why everything that can run on your device stays free and unlimited. If your PDF already has a text layer and you only want the words out, PDF to Text does that free.',
    href: '/ocr-pdf',
  },
  {
    date: '2026-08-27',
    kind: 'new',
    title: 'Keep a web page exactly as it looks today',
    detail:
      'Paste an address and get a PDF of the page — the whole page, not one screenful like a screenshot. It is for the things that do not stay put: a price before it changes, terms before they are quietly updated, a listing before it is taken down, a confirmation screen you want a record of. A real browser visits the address, prints it, and we keep nothing. It cannot open anything behind a login, because our server visits as a stranger with no access to your accounts — for those, print from your own browser. Three captures a day free, unlimited on Pro.',
    href: '/webpage-to-pdf',
  },
  {
    date: '2026-08-27',
    kind: 'new',
    title: 'Give a long PDF a table of contents in one click',
    detail:
      'A hundred-page report with no bookmarks is a scroll bar and a guess. Add bookmarks to a PDF builds the whole clickable outline from the document’s own headings — press the button, check what it found, save. You can also add entries by hand, rename them, point them at different pages, drag them into a sensible order and nest them as deep as you like, and any bookmarks the file already had are loaded ready to edit. Deleting a heading keeps everything underneath it rather than taking the whole branch with it, and saving with none at all cleanly strips the bookmarks a file arrived with. It runs in your browser like the rest of the free tools.',
    href: '/add-bookmarks-to-pdf',
  },
  {
    date: '2026-08-27',
    kind: 'fixed',
    title: 'The camera tools opened as a big black rectangle',
    detail:
      'Receipt scanner and Scan to PDF both greeted you with an empty black box most of the screen tall, with one line of text floating in the middle of it. The camera viewfinder was being drawn at full size whether or not the camera was actually running — so before you had granted permission to anything, the page was mostly a black void. Now you get a normal, compact panel until the camera is on, and the viewfinder itself no longer tries to fill a widescreen monitor when it starts.',
    href: '/receipt-scanner',
  },
  {
    date: '2026-08-26',
    kind: 'improved',
    title: 'The little green padlock was telling you the opposite of the truth',
    detail:
      'Every tool that runs inside your browser carried a small padlock in the corner of its card. We meant "your file never leaves your device". A customer read it the way anyone would — a padlock in the corner of a card is where apps put the badge that means locked, premium, not for you — and asked why the tool was locked. He was right and we were wrong. It is now a crossed-out cloud, which is the same picture as the badge on our server tools with a line through it: cloud means the file goes to us, cloud with a line means it never does. Hover any of them and you now get the full sentence rather than having to scroll to the legend. Nothing changed about how the tools work — they were always free, and your files were always staying put.',
    href: '/tools',
  },
  {
    date: '2026-08-26',
    kind: 'new',
    title: 'Fix what a PDF says it is — and four more ways out of one',
    detail:
      'Every PDF quietly announces a title, an author and the program that made it, which is why a file saved as contract-final still introduces itself as “Microsoft Word - Untitled1”, and why a document can arrive carrying a colleague’s name. Edit PDF details lets you set all of that. The reason other tools appear to do this and change nothing: a PDF can record the same facts twice, in an old information block and in a newer XMP packet, and Acrobat believes the second one — so we write both, and tell you when a file is disagreeing with itself. Drop a stack of PDFs to stamp one author across all of them. Alongside it: PDF to RTF for the software that refuses a .docx, PDF to ODT for people who work in LibreOffice, and OpenDocument to PDF for ODT, ODS, ODP and ODG in one place. PDF to HTML gives you a real web page — selectable text, headings, lists and tables, built in your browser rather than uploaded, because the usual server route turns every paragraph into a picture.',
    href: '/edit-pdf-metadata',
  },
  {
    date: '2026-08-26',
    kind: 'new',
    title: 'Four things a page can need doing to it',
    detail:
      'Scan a book and every sheet holds two pages, which no reader will separate for you — Split pages in half cuts them apart, and it knows that in Arabic, Hebrew and manga the left-hand page is the second one, not the first. Pages per sheet does the opposite, putting 2, 4, 9 or 16 pages on one sheet so a long document prints short; the pages are placed as real pages rather than pictures, so they stay sharp however small they get. Change page size gives a document one size — and its more useful half simply asks what size the file already mostly is and makes the stragglers match, which is what you want after merging things from three different places. Rasterize turns every page into a picture, for when a document has to look identical everywhere and nothing in it should be selectable; it says plainly that this cannot be undone. All four run in your browser, on any file, free.',
    href: '/split-pages-in-half',
  },
  {
    date: '2026-08-24',
    kind: 'new',
    title: 'Put your letterhead back on a PDF',
    detail:
      'Some documents arrive plain and have to go out on headed paper — an invoice from your accounting software, a letter from a template, a form that needs the pre-printed background it was designed for. Until now that meant printing it, or paying for desktop software. Overlay PDF lays one PDF over another: the letterhead, the background, or a stamp page such as DRAFT or PAID, applied across the whole document or only the pages you name. It takes a whole PDF as the stamp rather than a picture of one, so the vectors, the embedded fonts and the transparency all come through exactly as they were designed — which a watermark image cannot do. You can put it on top at any opacity, or behind the page where the page allows it. Both files are opened and combined inside your browser, which matters more here than almost anywhere else: a letterheaded invoice is precisely the document you should not be uploading to a stranger.',
    href: '/overlay-pdf',
  },
  {
    date: '2026-08-23',
    kind: 'improved',
    title: 'Passport photo pages now tell you the whole requirement',
    detail:
      'Each country page used to be a sentence and a short list: the size in millimetres, the background colour, and not much else. It now carries the full requirement — the size in millimetres, inches and pixels at both 300 and 600 DPI, the background, any file-size limit, and the head height in millimetres rather than as a percentage, because "70 to 80 percent" is not a thing you can hold a ruler against and head height is the measurement most photos are rejected for. There is a section on how to measure it, a note on how many copies fit on a single 4×6 print so you can get a set made for the price of one photograph, and links to the other destinations that publish exactly the same size, since one photo often covers several trips. All of the figures are generated from the spec table the tool itself uses, so the page and the photo it makes can never disagree with each other.',
    href: '/passport-photo',
  },
  {
    date: '2026-08-23',
    kind: 'feature',
    title: 'See exactly what compression changed, instead of squinting',
    detail:
      'The quality preview used to put the original and the compressed page side by side and leave you to spot the difference. At the gentler settings there is nothing to spot — which is the whole point, but it reads as though the tool is broken. So it now tells you instead of asking you. It says in words whether anything visible changed, and it lists what was actually done: text untouched and still selectable, and the page image resized from one size to another at a stated quality. There is a "Show what changed" view that paints the page black where nothing moved and bright where it did, amplified ten times, because the changes worth seeing are small ones. And when a page is already close to the smallest size that stays readable, it now says so plainly — that every setting will produce the same page and only the file size differs — instead of leaving you switching between four buttons wondering why nothing happens. None of it is an estimate: it is measured from the actual page your settings will produce, on your device, before you commit to anything.',
    href: '/compress-pdf',
  },
  {
    date: '2026-08-22',
    kind: 'fixed',
    title: 'Photos that said they were one thing and were another',
    detail:
      'Some phones — Samsung handsets in "high efficiency" mode, and several apps that pass a picture along to another app — save a photograph in Apple\'s HEIF format but label the file .jpg. Every tool here believed the label, handed the file to a JPEG reader that refused it, and told you your browser could not open that image format, which was both unhelpful and untrue. Photos are now identified by what is actually inside them rather than what the name claims, so a mislabelled photograph converts like any other. When something genuinely cannot be read, the message now names the format we found and what the browser said about it, instead of a shrug. And every picked file is read the moment you choose it rather than at the moment you press Convert, which closes a window in which a photo could quietly become unreadable in between.',
    href: '/jpg-to-pdf',
  },
  {
    date: '2026-08-22',
    kind: 'improved',
    title: 'Choose how big the PDF should be',
    detail:
      'Photos out of a phone are big — three of them make a PDF of about nine megabytes, which is more than most mail servers will send. Until now that was the only thing this tool would give you, because it embeds each picture exactly as it is and never re-compresses. That is still the default, and still the right answer when the pages are going to be printed or filed. But there is now a File size choice next to page size: Smaller file — now the default — resizes each photo to about four megapixels, which took a twelve-megapixel photograph of a document from 1.6MB down to 286KB in our testing with the text still crisp, and Smallest file goes down to 81KB for something that only has to be read on a screen. Choose Original quality to go back to embedding every photo exactly as it is. The tool says what each setting will do before you convert. If a picture is already small enough that re-compressing it would make it bigger — which happens more often than you would think — it is left alone, because a button marked "smaller" should never hand back something larger.',
    href: '/jpg-to-pdf',
  },
  {
    date: '2026-08-22',
    kind: 'improved',
    title: 'iPhone photos go straight into a PDF now',
    detail:
      'Photographs taken on an iPhone are saved as HEIC, a format Chrome, Edge and Firefox cannot open — so until now, dragging one into JPG to PDF or Scan to PDF got you nothing useful unless you were on a Mac. Both tools now decode HEIC themselves, using the same decoder that has always powered HEIC to JPG, so a photo taken on a phone converts on any browser without being re-saved first. The decoder is only fetched if a HEIC actually turns up; if you never use one, nothing extra is downloaded. Ordinary JPGs and PNGs are still embedded exactly as they are, with no re-compression. Samsung phones set to "high efficiency" save the same format and work the same way. And when an image genuinely cannot be read, the tool now names the file and says why, instead of "please try different files" — which was never much help.',
    href: '/jpg-to-pdf',
  },
  {
    date: '2026-08-22',
    kind: 'fixed',
    title: 'Scan to PDF: the camera works, and no photo disappears quietly',
    detail:
      'Three things were wrong here, all on phones. Tapping “Use camera” asked for permission and then showed a black rectangle, because the camera was switched on a fraction of a second before there was anywhere to show it. When the camera could not start, the reason given was always “no camera available” — which was rarely true; usually permission had simply been declined, and now it says so and tells you where to turn it back on. And “Add photos” opened the camera instead of your gallery on Android, which is the opposite of what it says. Separately, adding a photo the browser could not read took the whole page down with an error message rather than skipping that one file; it now names the file and carries on. Same fix in JPG to PDF, where files left out of a selection were left out in silence — they are now listed, with the reason.',
    href: '/scan-to-pdf',
  },
  {
    date: '2026-08-10',
    kind: 'new',
    title: 'Coming soon: preview every file in a folder',
    detail:
      'Windows shows you a thumbnail for pictures and videos, and the same grey icon for everything else — so a folder of forty PDFs, spreadsheets and notes is forty identical rectangles, and the only way to find the one you want is to open them one at a time. Folder Preview draws the rest of them too: the first page of each PDF, the top rows of each spreadsheet, your markdown, your code, your fonts and your vectors, all on one screen. Files it genuinely cannot draw — Photoshop, Word, archives — are still listed, with the reason, because hiding them would make your folder look emptier than it is. It only exists because nothing is uploaded: handing your whole folder to a website is not something you would sensibly do, and here you are not doing it. It is being tested now and will open shortly.',
    href: '/folder-preview',
  },
  {
    date: '2026-08-08',
    kind: 'new',
    title: 'For developers: our engines, running in your users’ browser',
    detail:
      'If you build software that handles other people’s documents, there is now a way to use what powers these tools inside your own app. Every other PDF service works by taking a copy of the file onto their servers; this one runs in the browser tab, so the document never goes anywhere — which means no vendor for your customers to vet, nothing to add to a data-processing agreement, and no bill that grows with usage, because the work happens on the computer in front of them. It handles the page work: merging, splitting, extracting, deleting, rotating and clearing metadata. It is deliberately clear about what it will not do, including the things that would need a server. Details at /developers.',
    href: '/developers',
  },
  {
    date: '2026-08-08',
    kind: 'new',
    title: 'A certificate to hand over with a redacted file',
    detail:
      'When you redact a PDF you now get a receipt to send alongside it. It records which pages were redacted, how many areas, and — the part that matters — whether any selectable text survived underneath, because a black box drawn over live text is not a redaction. It also carries the fingerprint of that exact file, so whoever receives it can confirm they were sent the document the certificate describes and not a later edit. There is a page at /verify-redaction where anyone can check one: no account, and the comparison happens in their browser. Both the certificate and the check are made on your device, which is also why the certificate is honest about what it cannot prove — it records your computer’s clock, not a notarised timestamp.',
    href: '/verify-redaction',
  },
  {
    date: '2026-08-08',
    kind: 'new',
    title: 'Written for the work you actually do',
    detail:
      'Four new pages for the people whose job makes our approach matter rather than merely nice: law firms, accountants, healthcare and schools. Each one names the rule you work under, walks through the everyday jobs it makes awkward — redacting before production, converting a client statement, releasing a record — and says plainly where we are not the right tool. That last part is deliberate. Most online file tools promise to delete your document after an hour, which quietly concedes they received it; ours never does, and these pages explain what that changes for you.',
    href: '/for/legal',
  },
  {
    date: '2026-08-08',
    kind: 'improved',
    title: 'The Tools menu now shows everything at once',
    detail:
      'Opening Tools used to give you a narrow dropdown with the whole catalogue squeezed into four columns behind a scrollbar — you had to scroll a menu to find out what was in it. It now opens across the full width of the page, so every tool is on screen together, grouped and readable at a glance, with a close button in the corner. Escape closes it too.',
  },
  {
    date: '2026-08-07',
    kind: 'new',
    title: 'Your account page now shows exactly what we hold — and lets you take it or delete it',
    detail:
      'The account page used to show your name and your plan and little else. It now lists everything of yours that sits on our servers, counted, including the lines that read none — because for most people almost every line reads none, and that is the whole point: files you put through the in-browser tools never reach us, so there is nothing to list. Under that, two buttons we should have had from the start. Download everything gives you one JSON file with every row in that list, immediately, with no request form and no waiting. And you can delete your account outright: it takes your email and your password to confirm, then removes everything straight away — no thirty-day grace period, no copy kept, because deleted should mean deleted. You can also set or change your password there, and if you signed up with Google it offers to set one rather than asking for a password you never chose.',
    href: '/account',
  },
  {
    date: '2026-08-07',
    kind: 'improved',
    title: 'You stay signed in for longer, and properly',
    detail:
      'Signing in now lasts a month instead of a week, and it renews itself whenever you come back — so using DiemDesk regularly keeps you signed in indefinitely, rather than logging you out on a fixed schedule no matter how often you visit. When a session genuinely does run out, the whole site now agrees about it at once: you get told plainly and offered a way back in, instead of one page saying “please sign in” while the rest still shows you as logged in.',
  },
  {
    date: '2026-08-07',
    kind: 'fixed',
    title: 'Your account page no longer gets stuck when your session runs out',
    detail:
      'Signing in lasts about a week. When it ran out, the account page didn’t say so — it still showed your name and your plan while the subscription section span forever and the billing button showed a technical error message that meant nothing to anyone. It now tells you plainly that your session has expired and offers to sign you back in, and any billing hiccup shows a real message with a Try again button instead of an endless spinner.',
    href: '/account',
  },
  {
    date: '2026-08-07',
    kind: 'improved',
    title: 'Easier to read, and usable with a screen reader or keyboard',
    detail:
      'We ran the whole site through an accessibility audit and fixed what it found. Text that was slightly too faint to read comfortably — badges, captions, the small print in the footer, section headings in dark mode — is now properly legible in both themes. Every file picker, slider, colour control and switch has a proper name, so a screen reader says what it is instead of announcing an unlabelled button; the search box now behaves like a real combobox as you arrow through results. Links inside paragraphs are underlined rather than only colour-coded. And if you have "reduce motion" turned on in your system settings, nothing on the site loops or pulses any more — that setting is now respected everywhere rather than in a few hand-picked places.',
  },
  {
    date: '2026-08-07',
    kind: 'fixed',
    title: 'A button near the bottom of the screen no longer ignores you on a phone',
    detail:
      'The privacy notice that appears on your first visit sits at the bottom of the screen, and on a small screen it was covering the last part of the page. Anything underneath looked completely normal and simply did nothing when you tapped it — on the favicon generator, that was the Download button. The page now leaves room for the notice, so you can always scroll past it and reach whatever is down there. If you ever tapped something and nothing happened, this may well have been why.',
  },
  {
    date: '2026-08-07',
    kind: 'improved',
    title: 'Cancel your subscription yourself, in two clicks',
    detail:
      'Your account page now lists every paid subscription you have — monthly or annual — with what it costs, when it renews, and a Cancel button that actually cancels. No email, no support ticket, no hunting for a link. If you’re still inside the 14-day money-back window, the page tells you the exact date it closes and offers to refund your last payment on the spot; the money goes back to your card immediately rather than after somebody reads a message. Past that date you can still cancel any time — you simply keep what you’ve paid for until the period ends, and we say so plainly instead of leaving you guessing. Changed your mind before it lapses? There’s a button to keep it. We also ask why you’re leaving, and we do read the answers.',
    href: '/account',
  },
  {
    date: '2026-07-28',
    kind: 'new',
    title: 'A proper welcome for first-time visitors',
    detail:
      'The very first time you land on the home page, the DiemDesk mark builds itself in and lifts away in about a second — a small hello, shown once and never again. It skips the moment you tap, scroll or press a key, never delays the page (which is already there underneath), and stays out of the way if you land straight on a tool from search. Installed on your phone, the app now opens with a clean branded splash too.',
  },
  {
    date: '2026-07-24',
    kind: 'new',
    title: 'Every tool page now shows its own receipts',
    detail:
      'Three additions you won’t find on other file sites. A live counter on each tool measures the bytes of your file that actually leave the tab — it reads zero on our in-browser tools because it has to, and on the few tools that use our server it counts up and says so. Under that, “What this does to your file” lists every change in plain words, including the awkward ones like invalidated signatures. And “Where this won’t help” names the cases we’re the wrong tool for, and points you at the right one — sometimes someone else’s.',
  },
  {
    date: '2026-07-23',
    kind: 'improved',
    title: 'Try a tool without leaving the home page',
    detail:
      'The home page now opens with a working compressor instead of a picture of one — drop a PDF straight into the hero and watch it shrink on your own device, then carry the same file into the full Compress tool without re-uploading it. Open your browser’s Network tab while it runs: you’ll see nothing leave your machine. Further down, a new section shows what using any tool actually looks like — same three steps, every time.',
    href: '/',
  },
  {
    date: '2026-07-23',
    kind: 'new',
    title: 'PDF to Audio — have any PDF read aloud',
    detail:
      'Listen to a PDF instead of reading it: pick a voice, set the speed and pitch, press Play and follow the highlighted sentence — tap any sentence to jump there. It uses your device’s own voice, so the file never leaves your browser. Free (a downloadable MP3 is coming with Pro).',
    href: '/pdf-to-audio',
  },
  {
    date: '2026-07-23',
    kind: 'new',
    title: 'Bates numbering — sequential stamps for legal files',
    detail:
      'Add Bates numbers (like ABC-000001) to your PDFs for legal discovery and case files. Set the prefix, starting number, padding and corner, watch a live preview, and drop several files to number the whole set continuously — file two picks up where file one ended. Runs on your device, never uploaded. Free.',
    href: '/bates-numbering',
  },
  {
    date: '2026-07-23',
    kind: 'new',
    title: 'PDF to Markdown — clean, editable text from any PDF',
    detail:
      'Convert a PDF into tidy Markdown — headings, lists and tables kept as GitHub-flavoured Markdown — for your notes app, a static site, or pasting into an AI chat. Toggle heading and table detection, preview it rendered or raw, then Copy or download a .md file. Runs entirely in your browser; the file is never uploaded. Free.',
    href: '/pdf-to-markdown',
  },
  {
    date: '2026-07-22',
    kind: 'improved',
    title: 'Stronger protection for your account',
    detail:
      'We hardened sign-in against automated password-guessing: repeated login attempts are now rate-limited at the network edge before they ever reach our servers, alongside bot filtering. Normal sign-ins are unaffected — this only slows down attacks.',
    href: '/security',
  },
  {
    date: '2026-07-22',
    kind: 'new',
    title: 'Receipt Scanner — snap a receipt into your budget',
    detail:
      'Photograph a receipt and it reads the amount, store and date, then drops the expense straight into your Budget Tracker after you confirm. A Pro tool (launching with Pro); the photo is scanned on our server and deleted immediately.',
    href: '/receipt-scanner',
  },
  {
    date: '2026-07-22',
    kind: 'new',
    title: 'Habit Tracker and Budget Tracker',
    detail:
      'Two simple daily tools, synced to your account: build streaks with the Habit Tracker, and see where your money goes with the Budget Tracker’s monthly total and category breakdown. Both free (with generous limits), no ads.',
    href: '/habits',
  },
  {
    date: '2026-07-22',
    kind: 'new',
    title: 'Smart Notes — quick notes that follow you',
    detail:
      'Fast, clean notes that sync to your account across every device — search across everything, tag to organize, and they save as you type. Free to use (up to 10 notes; Pro for unlimited), no ads.',
    href: '/notes',
  },
  {
    date: '2026-07-22',
    kind: 'new',
    title: 'Link in Bio — one page for all your links',
    detail:
      'Build a clean, ad-free link page at your own diemdesk.com/u/handle — your photo, a short bio, your links, and a theme. Share the single link everywhere. A Pro feature, launching with Pro.',
    href: '/link-in-bio',
  },
  {
    date: '2026-07-22',
    kind: 'new',
    title: 'PDF to PowerPoint and PDF to PDF/A',
    detail:
      'Two new conversions: turn a PDF into an editable PowerPoint deck (each page becomes a slide), or into archival PDF/A for filings and long-term records that must open identically for decades. Three free a day; your file is converted on our server and deleted the instant it downloads.',
    href: '/pdf-to-powerpoint',
  },
  {
    date: '2026-07-21',
    kind: 'new',
    title: 'Scan to PDF — your camera is now a scanner',
    detail:
      'Point your phone at a document and capture clean, multi-page PDFs — with a readability boost that makes a photo read like a proper scan. No camera? Add photos you already took. The camera stream and every page stay in your browser; nothing is uploaded.',
    href: '/scan-to-pdf',
  },
  {
    date: '2026-07-21',
    kind: 'new',
    title: 'Repair PDF — fix files that won’t open',
    detail:
      'Got a PDF that shows up blank or says “file is corrupt”? Repair PDF rebuilds the page index that’s usually broken and tells you honestly how many pages came back — all on your device, so the damaged file is never uploaded.',
    href: '/repair-pdf',
  },
  {
    date: '2026-07-21',
    kind: 'improved',
    title: 'A calmer, faster home page',
    detail:
      'The tools section is no longer a wall of tiles: a quiet category rail lets you focus on one group at a time, and the footer is easier to scan on a phone. Same tools, less clutter.',
  },
  {
    date: '2026-07-21',
    kind: 'improved',
    title: 'Redact: cleaner boxes, smarter AI matching',
    detail:
      'Redaction boxes now stay clean on the page — tap one to select it and a single Remove button appears (no more accidental deletes). The AI personal-info finder locates fragmented account numbers and multi-line addresses it previously missed, and lists each value once with the pages it appears on. Verified against real bank statements.',
    href: '/redact-pdf',
  },
  {
    date: '2026-07-20',
    kind: 'improved',
    title: 'Your work now survives tab switches',
    detail:
      'Browsers quietly evict heavy background tabs to save memory — which used to wipe your loaded file. Now 19 tools save your file and edits on your device and silently pick up exactly where you left off when you come back.',
  },
  {
    date: '2026-07-20',
    kind: 'ai',
    title: 'The AI document suite is complete — launching with Pro',
    detail:
      'Eight AI tools, built and ready behind the scenes: Chat with PDF, page-cited Summaries, Translate with a do-not-translate glossary, a Question generator with Anki/Moodle export, PDF→Excel table clean-up, meaning-level document compare, AI find-personal-info for Redact, and natural-language commands in the search palette. Every answer cites the page it came from, and your file never leaves your device — only text does, and only when you ask.',
    href: '/pricing',
  },
  {
    date: '2026-07-20',
    kind: 'improved',
    title: 'Faster first file-drop on every PDF tool',
    detail:
      'The PDF engine now warms up in the background the moment a tool page opens, so your first drop starts processing immediately instead of pausing to load machinery.',
  },
  {
    date: '2026-07-20',
    kind: 'fixed',
    title: 'Offline caching rebuilt, carefully',
    detail:
      'Once you have used a tool online, it keeps working in that browser without a connection. The previous version of this could pin browsers to an outdated copy of the site — the rebuild makes that impossible, and we soak-tested it for a week before saying so here.',
  },
  {
    date: '2026-07-15',
    kind: 'new',
    title: 'PDF → Excel, free and on-device',
    detail:
      'Extract tables from statements, invoices and reports into a real .xlsx or CSV — detected, highlighted on the page, and editable before export. Runs entirely in your browser; the big names upload your file to their servers for this.',
    href: '/pdf-to-excel',
  },
  {
    date: '2026-07-15',
    kind: 'new',
    title: 'Share straight from Gmail on Android',
    detail:
      'Install DiemDesk and it appears in Android’s share sheet — share a PDF from Gmail and it opens in the viewer, ready to hand off to any tool without re-uploading.',
    href: '/pdf-viewer',
  },
  {
    date: '2026-07-14',
    kind: 'new',
    title: 'PDF viewer with no-re-upload hand-off',
    detail:
      'Open a PDF once, then send it to Compress, Split, Sign, Fill-form and more with one click — the file travels between tools on your device, never uploaded twice.',
    href: '/pdf-viewer',
  },
  {
    date: '2026-07-14',
    kind: 'new',
    title: '16 developer & data tools',
    detail:
      'Base64, JSON↔CSV, regex tester, hash generator, diff checker and a dozen more — all instant, all in your browser.',
    href: '/developer-tools',
  },
  {
    date: '2026-07-13',
    kind: 'launch',
    title: 'DiemDesk opens to the public',
    detail:
      'The gate came down: 50+ tools live at diemdesk.com, free to use, no signup, no watermarks — and your files stay on your device.',
    href: '/overview',
  },
  {
    date: '2026-07-12',
    kind: 'new',
    title: 'Sign in with Google',
    detail: 'One-tap sign-in, using Google’s verified-identity flow — we never see or store a password.',
  },
  {
    date: '2026-07-11',
    kind: 'new',
    title: 'On-device batch processing on six tools',
    detail:
      'Compress, convert, resize, rotate and strip metadata from many files at once — each processed on your device, zipped for one download.',
  },
  {
    date: '2026-07-10',
    kind: 'improved',
    title: 'Split by file size, and a faster Compress',
    detail:
      'Split a PDF into parts under a size cap (email limits, portal limits), and Compress now skips font work on scans — over three minutes down to about 25 seconds on a large scanned file.',
    href: '/split-pdf',
  },
  {
    date: '2026-07-02',
    kind: 'launch',
    title: 'DiemDesk.com goes live',
    detail: 'The product got its name and home: diemdesk.com, served over HTTPS through Cloudflare.',
  },
];

export const KIND_META: Record<ChangeKind, { label: string }> = {
  new: { label: 'New tool' },
  feature: { label: 'New feature' },
  improved: { label: 'Improved' },
  fixed: { label: 'Fixed' },
  ai: { label: 'AI' },
  launch: { label: 'Milestone' },
};
