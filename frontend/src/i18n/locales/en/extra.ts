// 与上游合并时新增的文案（自动生成后可手工整理进各命名空间）
export const enExtra = {
  "studio": {
    "editor": {
      "publishMarketplace": "Publish to marketplace"
    },
    "style": {
      "resolution": "Resolution",
      "errModelUnsupported": "The selected model doesn't support these settings or has no price configured. Check the model, resolution and aspect ratio."
    },
    "board": {
      "stopGenerate": "Stop generating",
      "errStop": "Failed to stop",
      "downloadFinal": "Download final video",
      "errDownload": "Download failed",
      "publishMarketplace": "Publish to marketplace",
      "opPreviewVideo": "Preview video",
      "subtitleHintFull": "Used as a storyboard note (not burned into AI video)",
      "subtitleHintStill": "Optional; shown with the title in the final video",
      "imgPromptStill": "Image description",
      "imgPromptHintStill": "Describe the characters, setting and action; regenerate this image after editing"
    }
  },
  "drama": {
    "episodesStep": {
      "planFailedShort": "Storyboard failed",
      "awaitingPlan": "Awaiting AI storyboard"
    },
    "outlinePreview": {
      "durationScriptChanged": "Duration estimated from the current script; existing shots are from an older draft"
    },
    "outlineEp": {
      "genTitles": {
        "creative": "Generating creative notes for this episode",
        "summary": "Generating episode summary",
        "brief": "Extracting episode summary",
        "body": "Generating shooting script",
        "full": "Regenerating the whole episode",
        "default": "Generating episode content"
      },
      "jobFailedOrCancelled": "Episode generation failed or was cancelled",
      "selectEpisodeFirst": "Please select an episode first",
      "episodeMissing": "Episode not found, please refresh",
      "saveBeforeGenerate": "Save or cancel your current edit before generating.",
      "saveBeforeEnter": "Save or cancel your current edit before entering the storyboard.",
      "saveSceneFirst": "Save or cancel the scene you are editing first.",
      "needSummaryOrCreative": "Enter an episode summary of at least 40 characters, or creative notes of at least {n} characters",
      "needSummaryBeforeBody": "Fill in the episode summary before generating the shooting script",
      "bodyBeforeExtract": "The shooting script needs at least {n} characters before extracting a summary",
      "regenMessageV2": "The shooting script will be rewritten from the episode summary (or the creative notes if there is no summary). If this episode already has a storyboard, re-splitting will overwrite and clear generated shots. Continue?",
      "planGenerating": "AI storyboarding…",
      "planFailed": "Storyboard failed",
      "shotStatusStale": "{s} (old draft)",
      "shotStatusFew": "{s} (too few)",
      "wholeProgress": "Overall progress {done}/{total}",
      "waitingScript": "Waiting for script…",
      "waitingPlan": "Waiting for AI storyboard",
      "needSummary": "Summary needed",
      "emptySummaryGenerating": "Generating the series summary; assets and episode scripts follow…",
      "emptyAssetsSeeding": "Extracting the asset library, then generating episode scripts…",
      "unsavedEdit": "Unsaved edits",
      "planStale": "Storyboard needs update",
      "extracting": "Extracting…",
      "extractBrief": "Extract episode summary",
      "batchLocksHint": "This episode's script is still being generated, please wait",
      "otherJobHint": "Another episode is being generated",
      "bodyMinHint": "The script needs at least {n} characters",
      "noticeScriptChangedTitle": "Script updated, storyboard out of sync",
      "noticeScriptChangedBody": "The existing storyboard is from an old draft; re-split it after entering the storyboard.",
      "noticeSummaryTitle": "Generating series summary",
      "noticeSummaryBody": "Characters and scenes will be extracted next, then episode scripts.",
      "noticeAssetsTitle": "Extracting characters and scenes",
      "noticeAssetsBody": "Episode scripts start once the asset library is populated.",
      "noticeEpisodesTitle": "Generating episode scripts",
      "noticeEpisodesProgress": "{done} / {total} episodes done; you can browse finished ones.",
      "noticeEpisodesBody": "You can browse finished episodes.",
      "noticeThisBody": "Content updates automatically when done, please wait.",
      "noticeOtherTitle": "Episode {n} is being generated",
      "noticeOtherBody": "You can keep working on the current episode.",
      "noticePlanTitle": "AI storyboarding this episode",
      "noticePlanBody": "Open it to view and edit once done.",
      "noticePlanPreparing": "Script ready, preparing AI storyboard",
      "noticePlanSkippedTitle": "This episode was not storyboarded automatically",
      "noticePlanTooShortChars": "This episode script is too short for automatic AI storyboarding (about {have} characters, at least {need} needed). Extend the script (or let AI refine it), save, then click “Storyboard”.",
      "noticePlanTooShortWords": "This episode script is too short for automatic AI storyboarding (about {have} words, at least {need} needed). Extend the script (or let AI refine it), save, then click “Storyboard”.",
      "noticePlanFailedBody": "Automatic storyboarding could not start: {reason}. Click “Storyboard” to retry manually.",
      "summarySubV2": "Characters, conflict, twists and ending; the main basis for the shooting script",
      "summaryPlaceholderV2": "Write the episode summary (at least 40 characters), then generate the script",
      "extractFromScript": "Extract from script",
      "genFromNotes": "Generate from notes",
      "notesTitle": "Creative notes (optional)",
      "notesSub": "Add creative direction or keep early ideas; not needed once there is a summary",
      "notesPlaceholder": "Optional: character motives, creative direction or special requests"
    },
    "outline": {
      "pipelineSummary": "Generating series summary…",
      "pipelineAssets": "Extracting assets…",
      "pipelineEpisodes": "Generating episode scripts…",
      "pipelineEpisodesProgress": "Generating episode scripts · Progress {done}/{total}",
      "pipelineHintSummary": "Order: series summary → extract assets → episode scripts → AI storyboard for each episode right away",
      "pipelineHintAssets": "Extracting characters/scenes from the summary into the asset library; episode scripts start afterwards",
      "pipelineHintEpisodes": "Each episode is storyboarded by AI as soon as its script is done; see the “AI storyboarding…” status on the left",
      "summaryGeneratingSuffix": " · Generating series summary…",
      "assetsSeedingSuffix": " · Extracting assets…"
    },
    "teamLock": {
      "acquiring": "Acquiring edit lock…",
      "retryRefresh": "Reacquire edit access and refresh",
      "retry": "Reacquire edit access"
    },
    "cardMenu": {
      "publishMarket": "Publish to marketplace"
    },
    "output": {
      "noteEpisodeModel": "Applies to this episode's shots only; inherits the project default unless set. Ratio and resolution are filtered by the current video model; click to change.",
      "noteProjectModel": "All episodes share the same format; ratio and resolution are filtered by the current video model."
    },
    "assetLibrary": {
      "unnamedProject": "Untitled project",
      "unassigned": "No project",
      "kindDrama": "Drama project",
      "kindShortVideo": "AI short video",
      "playFailedRetry": "Playback failed, please retry",
      "digitalTitle": "Digital asset library",
      "digitalSubtitle": "Browse by image, video and audio; filter generated or not-yet-generated assets; images can be further filtered by character, scene and prop",
      "countItems": "{n} assets",
      "bannerTitle": "Create once, get inspired again and again.",
      "bannerText": "Project assets, shot videos and finished films are collected here and can be filtered by source project; standalone generations can also be previewed and downloaded.",
      "reload": "Reload",
      "loadingAssets": "Loading assets…",
      "srcFragment": "Shot video",
      "srcTask": "Generated result",
      "srcStandalone": "Standalone",
      "srcProject": "Project asset",
      "wsProject": "Project asset",
      "wsPersonal": "Personal asset",
      "playing": "Playing",
      "canPreview": "Preview available",
      "previewAudio": "Preview audio",
      "preview": "Preview",
      "viewAsset": "View asset",
      "openSourceProject": "Open source project"
    },
    "common": {
      "voiceGenDisabled": "Voice generation is temporarily disabled; pick an existing voice or upload audio."
    },
    "voiceBind": {
      "uploadBadType": "Please upload an mp3 / wav / m4a audio file",
      "uploadNoUrl": "Upload succeeded but no playable URL was returned",
      "pickOrUpload": "Please pick or upload a playable audio clip first",
      "leadUpload": "Give “{name}” a speaking voice. Pick an existing voice or upload a recording",
      "leadAiSuffix": ", or synthesize one with AI",
      "canvasHint": "On the canvas you can also connect an “Audio” node to the character with the same effect. Shots with dialogue will try to follow this voice.",
      "sourceAria": "Voice source",
      "uploadAudio": "Upload audio",
      "aiSynth": "AI synthesis",
      "noVoicesUploadOrAi": "No voices yet — use “Upload audio” or “AI synthesis” first.",
      "noVoicesUpload": "No voices yet — use “Upload audio” first.",
      "uploaded": "Uploaded",
      "uploadHint": "Supports mp3 / wav / m4a. A clear voice clip longer than 2 seconds works best.",
      "chooseAudioFile": "Choose audio file"
    },
    "list": {
      "relationAll": "All projects",
      "relationOwned": "Created by me",
      "relationJoined": "Joined",
      "relationAria": "Project category"
    },
    "seedanceRules": {
      "payload": {
        "refAudioDesc": ": sample audio of the characters / narration that speak in this shot and have a bound voice",
        "audioNoteSubtitle": "{code} is on by default: when a shot has spoken lines, Seedance voices them natively; subtitles are overlaid in post by default (no burned-in text); visual-only shots get ambient sound only.",
        "orderCharacterVoice": "[Required: character voice] — character name → reference audio index (bound and speaking in this shot)",
        "orderNarrationVoice": "[Required: narration voice] — narration → reference audio index (project narration voice bound)"
      },
      "script": {
        "assetNeedImageVoice": "Referenced characters need a reference image; speaking characters should have a bound voice sample, otherwise Seedance voices them on its own"
      },
      "usage": {
        "check2Voice": "Characters in the shot’s “Assets in shot” have reference images (missing images block generation); speaking characters should have a voice bound (a missing voice only warns)",
        "voiceTitle": "Voices and reference audio",
        "voiceBind": "Bind voice samples to characters in the asset library, episode, or canvas; when they speak in a shot, the sample is submitted as reference_audio",
        "voiceUnbound": "Without a bound voice, Seedance generate_audio voices the lines on its own",
        "voiceNeedImage": "Linked characters, scenes, and props must have a reference image (generated or uploaded) before a video can be generated"
      }
    }
  },
  "episode": {
    "assetPanel": {
      "voiceBound": "Voice bound"
    },
    "sidePane": {
      "publishMarket": "Publish to marketplace"
    },
    "edit": {
      "outputClamped": "Output adjusted to {label} for the current model; already generated shots must be regenerated to use it",
      "needRefFirst": "Add reference images first",
      "needRefImageHint": "Generate or upload reference images for the linked characters/scenes/props first.",
      "readOnlySave": "Read-only: storyboard cannot be saved",
      "enterCanvas": "Open canvas"
    },
    "canvas": {
      "quickAddDblClick": "Click to quick-add · or double-click empty space to create",
      "uploadAudio": "Upload audio",
      "openVoiceBindFailed": "Could not open voice binding",
      "selectAudioFile": "Please choose an audio file (MP3 / WAV / M4A…)",
      "audioTooLarge": "Audio must not exceed 30MB",
      "changeVoiceTitle": "Change or unbind the voice; you can also connect another audio node",
      "opening": "Opening…",
      "changeVoice": "Change",
      "bindVoiceTitle": "Upload/choose a voice, or connect an \"Audio\" node to this character",
      "bindVoice": "Bind voice",
      "mention": {
        "emptyConnected": "No connected nodes · connect a character/scene to this node first"
      },
      "gen": {
        "videoPlaceholderConnected": "Describe the visuals, camera movement and mood; type @ to reference connected nodes…",
        "videoHintConnected": "Enter to generate video · @ can only reference connected nodes · Shift+Enter for a new line",
        "imagePlaceholderConnected": "Describe the image; type @ to reference connected nodes…",
        "imageHintConnected": "Enter to generate · @ can only reference connected nodes · Shift+Enter for a new line",
        "optimizeFailed": "Description optimisation failed",
        "optimizeTitle": "Optimise the visual description while keeping dialogue and @ references",
        "optimize": "Optimise description",
        "submitting": "Generating",
        "promptLabel": "Prompt",
        "mentionHint": " · @ to reference connected nodes",
        "charCount": "{n} chars",
        "refLimitsTitle": "First/last frames and style boards count toward reference images; 0 means the model doesn't support this reference type.",
        "refLimits": "Reference limits: images {images} · videos {videos} · audio {audios}",
        "kbdGenerate": "generate",
        "kbdNewline": "new line"
      },
      "store": {
        "nodeAssetExists": "Could not create node: the asset is already on the canvas",
        "noAudio": "The selected asset has no usable audio",
        "voiceBindFailed": "Failed to bind voice",
        "audioNodeEmpty": "Upload or choose audio for the audio node first, then connect it to the character",
        "audioAssetMissing": "Audio asset not found",
        "defaultVoiceName": "Voice"
      }
    },
    "genOpts": {
      "imageParamsAdjusted": "The selected model doesn't support the previous settings; aspect ratio or resolution was adjusted. Please check the cost before generating.",
      "videoParamsAdjusted": "The selected model doesn't support the previous settings; the specs were adjusted. Please check duration and cost before generating."
    }
  },
  "lib": {
    "scriptValidate": {
      "missingImageBlocking": "These linked assets have no reference image. Generate or upload one before generating the video: {names}"
    },
    "genError": {
      "audioShort": {
        "messageDur": "{where}: the reference audio is about {sec}s; it must be at least 1.8s."
      },
      "notEnabled": {
        "title": "Image model not enabled",
        "suggestion": "Ask an administrator to enable this model for its channel in the admin console (System settings → Models), then try again."
      },
      "downloadInterrupted": {
        "title": "Video download interrupted",
        "message": "The video was generated upstream, but the connection dropped while downloading it to the server.",
        "suggestion": "The system will retry the download for the original task automatically. Do not regenerate this node."
      },
      "fetchFailed": {
        "title": "Network interrupted",
        "message": "The request to the server failed (Failed to fetch). The task may still be queued or already finished.",
        "suggestion": "Refresh the canvas to see whether the node already has a video; if not, click generate again. A backend --reload during development can also trigger this."
      },
      "audioPrivacy": {
        "title": "Reference audio failed the privacy review",
        "suggestion": "Check the voice bound to the character, update the reference audio, and generate again."
      },
      "audioUnreadable": {
        "title": "Reference audio could not be checked",
        "message": "Could not read the reference audio duration for {named}, or its URL is invalid.",
        "suggestion": "Check that the character or narration sample file is reachable, re-upload or regenerate it, then regenerate this shot."
      },
      "audioLong": {
        "title": "Reference audio too long",
        "message": "The reference audio for {named} is too long; it must be 30s or less.",
        "messageDur": "The reference audio for {named} is too long (about {sec}s); it must be 30s or less.",
        "suggestion": "Trim the character or narration sample audio, then regenerate this shot. This is not a reference image issue."
      },
      "invalidImage": {
        "title": "Invalid reference image format",
        "whereIndex": "item {n} of the submitted content / content[{idx}]",
        "whereAny": "a reference image",
        "message": "The video service failed image validation: {where}. This is not a reference audio duration issue.",
        "suggestion": "Check that the shot’s character and scene covers are PNG/JPG/WEBP. If the canvas has a separate voice node, make sure it is used only as reference audio and does not take a reference image slot. Fix the media, then regenerate this shot."
      }
    }
  },
  "assetLib": {
    "types": {
      "character": "Character",
      "scene": "Scene",
      "prop": "Prop",
      "voice": "Voice",
      "audio": "Audio",
      "image": "Image",
      "video": "Video",
      "text": "Text"
    },
    "voiceAsset": "Voice asset",
    "audioAsset": "Audio asset",
    "videoAsset": "Video asset",
    "noPreview": "No preview",
    "unnamed": "Untitled asset",
    "generating": "Generating",
    "selected": "Selected",
    "selectedPrefix": "Selected, ",
    "open": "Open {name}",
    "filterByType": "Filter by asset type",
    "searchPlaceholder": "Search asset name or description",
    "searchAria": "Search assets",
    "bannerTitle": "Create once, get inspired again and again.",
    "emptyTitle": "No matching assets",
    "emptyHint": "Adjust the filters, or add new assets in a project.",
    "filters": {
      "mediaAria": "Filter by media type",
      "imageCategory": "Image category",
      "imageCategoryAria": "Filter by image category",
      "allImages": "All images",
      "generationStatus": "Generation status",
      "generationStatusAria": "Filter by generation status",
      "all": "All",
      "generated": "Generated",
      "ungenerated": "Not generated"
    },
    "detail": {
      "title": "Asset details",
      "copied": "Full prompt copied",
      "copyFailed": "Copy failed, please copy manually",
      "downloadStarted": "Download started",
      "downloadFailed": "Download failed",
      "mediaPreview": "Media preview",
      "noText": "No text",
      "zoomOut": "Exit zoom",
      "zoomIn": "Zoom preview",
      "closeAria": "Close asset details",
      "genPrompt": "Generation prompt",
      "assetNote": "Asset description",
      "source": "Source",
      "model": "Model",
      "notRecorded": "Not recorded",
      "dimensions": "Media size",
      "audioDuration": "Audio length",
      "videoDuration": "Video length",
      "fileSize": "File size",
      "recordedAt": "Recorded at",
      "sourceProject": "Source project",
      "copyNote": "Copy description",
      "downloading": "Downloading…",
      "download": "Download",
      "close": "Close"
    },
    "info": {
      "yes": "Yes",
      "no": "No",
      "seconds": "{n}s",
      "source": {
        "upload": "Uploaded",
        "generated": "AI generated",
        "unknown": "Not recorded"
      },
      "params": {
        "requestedAspect": "Requested aspect ratio",
        "aspect": "Aspect ratio",
        "requestedResolution": "Requested resolution",
        "resolution": "Resolution",
        "requestedSize": "Requested size",
        "size": "Size",
        "duration": "Duration",
        "requestedDuration": "Requested duration",
        "videoMode": "Generation mode",
        "count": "Count",
        "negative": "Negative prompt",
        "strength": "Reference strength",
        "motion": "Motion amount",
        "imageStyle": "Visual style",
        "generateAudio": "Generate audio",
        "watermark": "Watermark",
        "cameraFixed": "Fixed camera",
        "seed": "Seed",
        "speaker": "Voice",
        "sampleText": "Sample text"
      },
      "modes": {
        "textToVideo": "Text to video",
        "firstLastFrame": "First & last frame",
        "omniReference": "Omni reference"
      }
    },
    "refs": {
      "numbered": "{kind} {n}",
      "listSep": ", ",
      "nameWithLabel": "{name} ({label})",
      "previewMention": "Preview {name}, {labels}",
      "collapse": "Collapse",
      "expand": "Show all",
      "sectionAria": "Reference media used for this generation",
      "title": "References",
      "kindTitle": "Reference {kind}",
      "preview": "Preview {label}",
      "previewNamed": "Preview {label}: {name}",
      "firstFrame": "First frame",
      "lastFrame": "Last frame",
      "audioAria": "{label}: {name}",
      "audioFallback": "Reference audio",
      "loadFailed": "Reference media can't be loaded right now"
    },
    "edit": {
      "genLabel": "Generate look",
      "deleteScene": "Delete scene",
      "deleteProp": "Delete prop",
      "deleteCharacter": "Delete character",
      "assetDeleted": "This asset was deleted. Close and reload.",
      "promptEmpty": "Prompt can't be empty",
      "savePromptFailed": "Failed to save prompt",
      "uploadFailed": "Upload failed",
      "restoreFailed": "Restore failed",
      "readOnly": "Read-only",
      "acquiringLock": "Acquiring edit lock…",
      "retry": "Try again",
      "generating": "Generating…",
      "editPrompt": "Edit the prompt for the next generation",
      "imagePrompt": "Image prompt",
      "promptPlaceholder": "Describe the look, composition, lighting and style…",
      "saving": "Saving…",
      "savePrompt": "Save prompt",
      "uploading": "Uploading…",
      "replaceImage": "Replace image",
      "uploadImage": "Upload image",
      "replaceVoice": "Change voice",
      "bindVoice": "Bind voice",
      "historyCount": "Version history · {n}",
      "viewHistory": "View version details",
      "restoring": "Restoring…",
      "restore": "Restore",
      "historyName": "{name} · previous version",
      "assetFallback": "Asset"
    }
  },
  "canvasTeams": {
    "loadFailed": "Failed to load projects",
    "title": "Project teams",
    "intro": "Each canvas project manages its own members. Invite collaborators by sharing the project.",
    "myProjects": "My projects",
    "filterAria": "Project team filter",
    "all": "All projects",
    "owned": "Created by me",
    "joined": "Joined",
    "note": "Member permissions apply only to that canvas project. Generation costs are deducted from the initiator's personal balance.",
    "loading": "Loading projects…",
    "retry": "Retry",
    "openCanvas": "Open canvas",
    "manage": "Manage members & invites",
    "viewMembers": "View project members",
    "empty": "No projects here yet. Create a canvas project or accept a project invite and it will show up here."
  },
  "teamBoundary": {
    "readOnlyNotice": "Read-only",
    "retryEdit": "Try editing again",
    "episodeMismatch": "This episode does not belong to the current project",
    "episodeLoadFailed": "Failed to load episode",
    "retry": "Retry",
    "loadingEpisode": "Loading episode and edit permission"
  }
}
