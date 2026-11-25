// 与上游合并时新增的文案（自动生成后可手工整理进各命名空间）
export const enExtra = {
  "common": {
    "pagination": {
      "perPageAria": "Items per page",
      "nav": "Pagination",
      "pageN": "Page {n}"
    },
    "dateRange": {
      "label": "Date range",
      "start": "Start date",
      "end": "End date",
      "to": "to"
    },
    "userSearch": {
      "matching": "Matching users",
      "find": "Find users",
      "count": "{n} users",
      "listLabel": "Search users",
      "failed": "Search failed, please retype and try again",
      "hint": "Type an email, nickname or account ID to search",
      "select": "select"
    },
    "secret": {
      "statusClearPending": "Cleared on save",
      "statusDraft": "New secret pending save",
      "statusNotConfigured": "Not configured",
      "onlySpaces": "The secret cannot contain only spaces.",
      "guideClearPending": "Only marked for clearing; takes effect after saving and can be undone.",
      "guideNew": "Enter a new secret and save; the reveal button only shows what you typed now.",
      "markedClear": "Marked for clearing",
      "hideLabel": "Hide new {label}",
      "showLabel": "Show new {label}",
      "hideInput": "Hide current input",
      "showInput": "Show current input",
      "undo": "Undo"
    }
  },
  "labels": {
    "payType": {
      "stripe": "Card · Stripe"
    }
  },
  "settings": {
    "saveBar": {
      "saveCurrent": "Save current settings",
      "savingSettings": "Saving settings…",
      "saveSection": "Save this section",
      "hint": "Changes on this page take effect after a successful save."
    },
    "oss": {
      "marketplaceNote": "The digital asset marketplace always uses the marketplace/ folder (independent of the folder below); files are uploaded privately and served via short-lived signed URLs. Keep the bucket private — this page does not change bucket permissions."
    },
    "runtime": {
      "form": {
        "defaultsTitle": "Generation defaults",
        "defaultsDesc": "Default quality, aspect ratio and duration for new generation tasks; the supported range still depends on the selected model.",
        "imageSizeHint": "Use a size the upstream supports, e.g. 2K or 1024x1024.",
        "videoQualityHint": "E.g. 480p or 720p, as supported by the current model.",
        "videoRatioHint": "Width:height, e.g. 16:9 or 9:16.",
        "egValue": "e.g. {v}",
        "seedanceMinHint": "At least 1 second; together with the maximum it bounds each segment.",
        "seedanceMaxHint": "Not less than the minimum; still limited by the model's duration range.",
        "unitSec": "s",
        "unitItem": "tasks",
        "unitLane": "lanes",
        "unitTimes": "times",
        "errSeconds": "Enter a number of seconds greater than 0",
        "errMinOne": "Enter an integer of at least 1",
        "errInteger": "Enter an integer",
        "errMaxLtMin": "Maximum duration cannot be less than the minimum",
        "errTimeout": "Timeout must be greater than the poll interval",
        "errRequired": "Enter a default value",
        "saveLabel": "Save runtime settings",
        "concTitle": "Task concurrency",
        "concDesc": "Controls how many tasks run at once and how much each user may occupy.",
        "globalSlotsHint": "Worker tasks that may run at once site-wide, at least 1.",
        "userSlotsHint": "Tasks a single user may occupy, still bounded by the site-wide slots.",
        "dramaVideoLimitHint": "Limits queued plus in-progress video tasks, at least 1.",
        "draftPrefix": "Current draft: site-wide",
        "draftMid": "execution slots, up to",
        "draftSuffix": " per user; tasks awaiting upstream polling do not occupy Worker slots.",
        "advTitle": "Advanced runtime parameters",
        "advDesc": "Pipeline allocation, polling and mock mode",
        "pipelineTitle": "Generation pipeline",
        "pipelineDesc": "Parallelism per media task type; each is an integer of at least 1.",
        "imageConcHint": "Image tasks processed at once.",
        "videoConcHint": "Video tasks processed at once.",
        "ttsConcHint": "Voice-over tasks processed at once.",
        "pollTitle": "Upstream polling & retries",
        "pollDesc": "Balance query frequency against wait time; the timeout must exceed the interval.",
        "pollIntervalHint": "Greater than 0 s; shorter intervals query the upstream more often.",
        "pollTimeoutHint": "Greater than the poll interval; waiting stops after this.",
        "selectorConcHint": "Maximum non-blocking queries per Selector round, at least 1.",
        "fragmentAttemptsHint": "Includes the first attempt and retries after failure, at least 1.",
        "devTitle": "Development & debugging",
        "devDesc": "Switch how generation requests run."
      }
    },
    "site": {
      "saveLabel": "Save site settings",
      "mp": {
        "marketplace": "Digital asset marketplace",
        "appVideo": "App video",
        "panelTitle": "3. Digital asset marketplace",
        "panelDesc": "Turn the entry on here when production has no env file",
        "enable": "Enable the digital asset marketplace",
        "enableDesc": "After saving, users see the «Digital asset marketplace» and the admin «Business» group shows «Marketplace operations». Uploads still use the storage settings.",
        "appEnable": "Enable the App video service",
        "appEnableDesc": "After saving, the App video list and playback open. Toggle here without changing container env vars; requires the marketplace to be enabled.",
        "maxDuration": "Maximum full video duration",
        "maxDurationHint": "In seconds. Default 1800 (30 minutes), shared by upload, compose and full App playback. Previews stay at most 15 s and no more than 30% of the original.",
        "shareTitle": "4. App engagement & sharing",
        "shareDesc": "Initial counts, real sharing and iOS / Android link association are all configured here, no env file changes needed.",
        "socialInit": "Auto-initialize engagement counts",
        "socialInitDesc": "Generates initial counts once for newly listed single videos and episodes eligible for the App. Backfill older works in marketplace operations; turning this off keeps saved counts.",
        "sharing": "Enable work sharing",
        "sharingDesc": "Allows sharing links to single videos and the current episode. Requires a valid public HTTPS domain, not localhost or a LAN address.",
        "shareBase": "Public share base URL",
        "shareBaseHint": "E.g. https://www.printfilm.com; the domain must forward /s/, /.well-known/apple-app-site-association and /.well-known/assetlinks.json to the backend, other pages go to the web app.",
        "teamIdHint": "Team ID from the Apple Developer account, used for Universal Links.",
        "androidPkg": "Android package name",
        "androidPkgHint": "Must match the Android applicationId; fill in together with the certificate fingerprint. Android sharing works without Apple configuration.",
        "androidSha": "Android signing certificate SHA-256 fingerprints",
        "androidShaHint": "One fingerprint per line, 32 colon-separated groups. Google Play uses the app signing certificate, not the upload certificate; multiple fingerprints are supported during rotation. /.well-known/assetlinks.json must be publicly reachable.",
        "androidShaPlaceholder": "AA:BB:… (full SHA-256 fingerprint)",
        "bundleHint": "iOS only; reuses the Bundle ID from «Payments & notifications → Apple server connection». Not needed for Android.",
        "iosNotConfigured": "iOS not configured",
        "footnote": "iOS needs Associated Domains and Android needs App Links, verified on a real device with the release signature. Saving the domain does not change DNS, reverse proxies or client projects."
      }
    },
    "payment": {
      "upstreamModules": "App payments & media pricing modules",
      "upstreamModulesDesc": "Apple / Google Play / Android and points-based image/video prices; each section saves on its own"
    },
    "routing": {
      "refLimits": {
        "error": "Enter an integer from 0 to 100",
        "advanced": "Advanced model settings",
        "pending": "{n} reference limits need fixing",
        "summary": "Configure reference counts per model",
        "title": "Reference media limits",
        "desc": "Limits the reference images, videos and audio per generation. Each value is an integer 0–100, 0 means unsupported; first/last frames and style boards count as images.",
        "model": "Model",
        "images": "Images",
        "videos": "Videos",
        "audios": "Audio",
        "unsupported": "Unsupported",
        "footnote": "Used to validate counts before a task is submitted. Image models accept image references only; actual support depends on the upstream model."
      }
    }
  },
  "layout": {
    "nav": {
      "adjustments": "Manual adjustments",
      "marketplace": "Marketplace operations"
    },
    "titles": {
      "teamDetail": "Team details"
    },
    "closeNav": "Close navigation",
    "openNav": "Open navigation",
    "skipToContent": "Skip to page content",
    "adminNav": "Admin navigation",
    "mainNav": "Main navigation",
    "search": {
      "trigger": "Search admin features",
      "placeholder": "Search features…"
    },
    "userSite": "User site"
  },
  "tasks": {
    "detail": {
      "notRecorded": "Not recorded",
      "tabs": {
        "upstream": "Upstream requests",
        "jsonRedacted": "Task JSON (redacted)"
      },
      "alerts": "Issues & hints",
      "waitingActivation": "Task not activated yet; waiting for prerequisites or a free concurrency slot.",
      "payloadHint": "These are internal scheduling parameters; see «Upstream requests» for what was actually sent upstream.",
      "frozen": "Currently frozen",
      "notSettled": "Not settled yet",
      "snapshotMode": "Billing mode at intake: {mode} · route pinned, no automatic failover",
      "sitePrice": "Site price #{v}",
      "legacyRules": "Legacy billing rules",
      "nSeconds": "{n} s",
      "nImages": "{n} images",
      "usageHint": "Usage lines are the billing basis; actual wallet charges and refunds follow the task settlement summary.",
      "delivered": "Delivered",
      "notDelivered": "Not delivered"
    },
    "descApiOnly": "Unified task platform · auto refresh {sec}s · this node is API-only; queues run on worker nodes",
    "runtime": {
      "noRecord": "No record yet",
      "secs": "{s}s",
      "minsSecs": "{m}m {s}s",
      "hoursMins": "{h}h {m}m",
      "ago": "{time} ago",
      "apiOnlyNode": "API-only node",
      "unknown": "Runtime: status unknown",
      "healthy": "Runtime: healthy",
      "unhealthy": "Runtime: unhealthy",
      "apiOnlyDesc": "This node serves API only; queues are handled by worker nodes",
      "loops": "Scheduler {scheduler} · poller {poller} · watchdog {watchdog}",
      "lastSuccess": "Last successful schedule: {ago}",
      "consecutiveFailures": "Consecutive failures: {n}",
      "oldestWait": "Oldest due task has waited: {time}",
      "legend": "«Deferred» means prerequisites or concurrency slots are not ready; «delayed» means the scheduled time has not arrived."
    },
    "stats": {
      "pendingBreakdown": "Ready {ready} · deferred {deferred} · delayed {delayed}",
      "activeBreakdown": "Running {running} · polling {poll} · cancelling {cancelling}",
      "nodeSlots": "Execution slots on this node",
      "apiOnly": "API only",
      "handledByWorkers": "Queues handled by worker nodes"
    },
    "queues": {
      "title": "Scheduling queues",
      "name": "{label} queue",
      "counts": "Queued {pending} · in flight {active} · concurrency {max}",
      "awaitingPoll": "Awaiting upstream {n}"
    },
    "cols": {
      "taskModel": "Task / model",
      "upstream": "Upstream",
      "billing": "Billing",
      "elapsed": "Elapsed",
      "userRef": "User / links"
    },
    "obs": {
      "phase": {
        "started": "Request started",
        "accepted": "Upstream responded",
        "failed": "Request failed",
        "poll": "Polling result",
        "simulated": "Local mock · parameters recorded"
      },
      "state": {
        "queued": "Queued upstream",
        "running": "Generating upstream",
        "succeeded": "Upstream done",
        "failed": "Upstream failed",
        "cancelled": "Upstream cancelled",
        "other": "Upstream status: {status}"
      },
      "providerOnly": "Upstream task exists · HTTP not recorded",
      "noUpstream": "No upstream requests yet",
      "billing": {
        "none": "Not pre-charged · not settled",
        "frozen": "Frozen · not settled",
        "settled": "Settled",
        "skipped": "Pre-charge skipped · not settled",
        "unknown": "Billing status not recorded"
      },
      "queueType": {
        "text": "Text",
        "image": "Image",
        "video": "Video"
      },
      "lane": {
        "text": "Audio & other",
        "image": "Image",
        "video": "Video"
      },
      "queueBadge": "{type} queue",
      "direct": "Direct",
      "directDesc": "Direct LLM call · no queue",
      "providerSuffix": " · upstream {status}",
      "stepNotRecorded": "Step not recorded",
      "modelNotRecorded": "Model not recorded",
      "actualModel": "Model actually requested",
      "actualModelShort": "Actual model",
      "simulatedModel": "Mock model",
      "selectedModel": "Model selected by task",
      "frozenAmount": "Frozen {amount}",
      "notCharged": "Not charged",
      "estimate": "Est. {amount}",
      "refundShort": " · refund {amount}",
      "refund": " · refunded {amount}",
      "unsettledSuffix": " · unsettled",
      "timing": "Timing",
      "waitRun": "Wait {wait} · run {run}",
      "notStarted": "Not started",
      "created": "Created {time}",
      "detail": "Details",
      "cancel": "Cancel task",
      "episodeRef": "Ep #{id}",
      "fragmentRef": "Shot #{id}",
      "pendingGeneric": "Pending",
      "waitingActivation": "Awaiting activation",
      "delayed": "Delayed",
      "ready": "Ready to schedule",
      "copied": "Copied",
      "copyFailed": "Copy failed, please select manually",
      "copy": "Copy",
      "status": "Status",
      "upstream": "Upstream",
      "viewRequests": "View requests",
      "providerTaskMissing": "Upstream task ID not recorded",
      "elapsed": "Elapsed",
      "billingLabel": "Billing · {state}",
      "settled": "Settled",
      "unsettled": "Unsettled",
      "breakdown": "Breakdown",
      "notRecorded": "Not recorded"
    },
    "upstreamPanel": {
      "redacted": "Redacted",
      "notOnPage": "Not on this page; page through to see history",
      "latestPhase": "Latest phase",
      "pageCount": "{page} on this page · {total} in history",
      "refresh": "Refresh upstream records",
      "hint": "Paged by event ID, newest first; submissions and responses are linked by request ID within a page. One request may span pages, and poll events may be sampled.",
      "retry": "Retry",
      "loading": "Loading upstream events for this page…",
      "empty": "No upstream HTTP requests or mock parameters recorded on this page. An upstream task ID or a finished task does not let us reconstruct the actual request body.",
      "localMock": "Local mock",
      "mediaGeneration": "Media generation",
      "endpointMissing": "Endpoint not recorded",
      "noHttp": "No HTTP sent",
      "model": "Model",
      "providerTask": "Upstream task",
      "requestId": "Request ID",
      "eventRef": "Event #{id}",
      "simulatedFinal": "Below are the actual URL, headers and JSON body prepared after channel routing, model mapping and protocol conversion (credentials redacted). The call was intercepted before HTTP and returned default media.",
      "simulatedLegacy": "This older record only kept business input, not the final HTTP body; mock tasks created from now on record the final request.",
      "mockParams": "Mock request parameters",
      "request": "Request",
      "response": "Response",
      "error": "Error",
      "stepData": "Step data (internal execution records)",
      "stepDataHint": "These are step inputs and results, not the HTTP body actually sent upstream.",
      "stepInput": "Step input",
      "stepOutput": "Step output"
    }
  },
  "templates": {
    "editor": {
      "errors": {
        "id": "Enter a template ID of 1–64 characters",
        "name": "Enter a template name of 1–128 characters",
        "shot_duration_min": "Minimum duration must be a whole number of seconds above 0",
        "shot_duration_max": "Maximum duration must be a whole number of seconds above 0",
        "maxLtMin": "Maximum duration cannot be less than the minimum",
        "sort_order": "Sort order must be an integer"
      },
      "untitled": "Untitled template",
      "perShot": "{min}–{max} s / shot",
      "willPublish": "Published after saving",
      "willUnpublish": "Saved as unpublished",
      "fixBasics": "Please complete the basics: {list}.",
      "errorSep": "; ",
      "sectionDisplay": "Display info",
      "sectionDefaults": "Generation defaults",
      "idHint": "Unique template identifier; cannot be changed after creation.",
      "nameHint": "Shown in the user's template picker.",
      "descHint": "Briefly describe suitable topics and visual style.",
      "categoriesHint": "Separate multiple tags with commas.",
      "sortHint": "Smaller numbers come first; negatives allowed.",
      "shotMaxHint": "Must not be less than the minimum.",
      "stylePromptHint": "Describes style, lighting and colour; used as the base style.",
      "characterPromptHint": "Appearance and wardrobe requirements for character images.",
      "extraPromptHint": "Extra shared requirements for image generation.",
      "llmSystemHint": "Extra instructions for the text model's scripting and planning.",
      "negativePromptHint": "List content or effects to avoid."
    }
  },
  "users": {
    "role": {
      "user": "Regular user",
      "admin": "Administrator"
    },
    "edit": {
      "adjustedSaved": "Balance adjusted and saved",
      "saveFailedRetry": "Save failed, please try again",
      "saveAdjust": "Confirm adjustment and save",
      "saveRole": "Save role change",
      "currentBalance": "Current balance",
      "frozen": "Frozen",
      "frozenHint": "Adjustments do not change amounts frozen by tasks",
      "permissions": "Account permissions",
      "roleHint": "Admins can open the admin console and manage all business data.",
      "adjustTitle": "Adjust account balance",
      "adjustDesc": "Turn on only when needed; changing only the role keeps the balance.",
      "direction": "Direction",
      "increase": "Increase",
      "decrease": "Decrease",
      "amount": "Adjustment amount",
      "amountHint": "Amount above 0, up to 2 decimals.",
      "noteHint": "The note is written to the wallet ledger for later reconciliation.",
      "notePlaceholder": "E.g. event bonus, refund clawback",
      "afterSave": "Balance after saving",
      "errEmpty": "Enter the amount to adjust",
      "errInvalid": "Enter a valid amount (up to 2 decimals)",
      "errZero": "Amount must be greater than 0",
      "errTooLarge": "Resulting balance is too large; reduce the amount",
      "errNegative": "Decrease cannot exceed the current balance"
    }
  },
  "orders": {
    "usage": {
      "modelPlaceholder": "Model (e.g. seedance-2.5)"
    }
  },
  "finance": {
    "adjustRecords": {
      "credit": "Increase",
      "debit": "Decrease",
      "loadFailed": "Failed to load adjustments",
      "title": "Manual adjustments",
      "desc": "Ledger entries from manual balance changes in user management, with operator and note",
      "allDirections": "All directions",
      "filter": "Filter",
      "listTitle": "Manual adjustment records",
      "total": "{n} total",
      "colTime": "Time",
      "colUser": "User",
      "colDirection": "Direction",
      "colDelta": "Change",
      "colBalance": "Balance after",
      "colOperator": "Operator",
      "colNote": "Note",
      "loading": "Loading…",
      "empty": "No manual adjustments yet"
    }
  },
  "marketplace": {
    "availability": {
      "loading": "Checking marketplace service status…",
      "error": "Could not get the marketplace service status. Please retry.",
      "reload": "Reload",
      "disabled": "The digital asset marketplace is not enabled yet. Enable it first, then retry.",
      "refresh": "Refresh service status"
    }
  }
}
