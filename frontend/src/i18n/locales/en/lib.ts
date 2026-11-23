/** en: lib 命名空间（t('lib.xxx')） */

export const enLib = {
  listSep: ', ',
  agentSkill: {
    none: 'No Skill',
  },
  media: {
    untitled: 'Untitled',
  },
  voice: {
    emptyPrompt: 'Voice description is empty',
    synthFailed: 'Voice synthesis failed',
    defaultCharacter: 'Character',
    assetName: '{name} voice',
  },
  compose: {
    clipLabel: 'Shot {n}',
    thisEpisode: 'Episode',
    fullSuffix: 'full',
    serverNoUrl: 'Server-side compose returned no downloadable URL',
    noClips: 'This episode has no shot videos to stitch yet',
    notMp4: '{name} is not a stitchable MP4',
    codecMismatch:
      'Shots use different encodings and can’t be stitched losslessly in the browser. Generate them with the same model, aspect ratio and resolution, then try again.',
    reasonSuffix: ' ({reason})',
  },
  assetImage: {
    generate: 'Generate look',
    regenerate: 'Regenerate look',
    version: {
      upload: 'Uploaded',
      replaced: 'Replaced',
      generate: 'Generated',
      restored: 'Restored',
      history: 'History',
    },
  },
  camera: {
    items: {
      empty: { label: 'Empty shot', insert: 'Empty shot: ', hint: 'Establish the setting, no dialogue or narration' },
      wide: { label: 'Wide shot', insert: 'Wide shot: ', hint: 'Show spatial relationships' },
      full: { label: 'Full shot', insert: 'Full shot: ', hint: 'Full body and surroundings in frame' },
      medium: { label: 'Medium shot', insert: 'Medium shot: ', hint: 'Waist up, common for dialogue' },
      close: { label: 'Close shot', insert: 'Close shot: ', hint: 'Chest up, closer to emotion' },
      closeup: { label: 'Close-up', insert: 'Close-up: ', hint: 'Face or key prop' },
      ecu: { label: 'Extreme close-up', insert: 'Extreme close-up: ', hint: 'Eyes, hands, details' },
      establish: { label: 'Establishing shot', insert: 'Establishing shot: ', hint: 'Set the scene and mood at the start' },
      atmosphere: { label: 'Atmosphere shot', insert: 'Atmosphere shot: ', hint: 'Light, weather or objects set the mood' },
      push: { label: 'Push in', insert: 'Push in: ', hint: 'Camera moves toward the subject' },
      pull: { label: 'Pull out', insert: 'Pull out: ', hint: 'Camera moves back to reveal space' },
      pan: { label: 'Pan', insert: 'Pan: ', hint: 'Camera stays put, sweeps horizontally/vertically' },
      truck: { label: 'Truck', insert: 'Truck: ', hint: 'Camera slides sideways to follow' },
      follow: { label: 'Tracking shot', insert: 'Tracking shot: ', hint: 'Follows a moving character' },
      high: { label: 'High angle', insert: 'High angle: ', hint: 'Looking down from above' },
      low: { label: 'Low angle', insert: 'Low angle: ', hint: 'Looking up from below' },
      aerial: { label: 'Aerial shot', insert: 'Aerial shot: ', hint: 'Wide bird’s-eye view' },
    },
    tips: {
      formula: 'Formula: subject + action + scene + (shot size/camera move) + (lighting)',
      axes: 'At most 2 motion axes per segment (push + pan is fine; push + pan + crane gets unstable)',
      rotation: 'Big rotations in close shots distort faces; keep orbits for medium shots or wider',
      visualOnly: 'Empty shots/shot sizes must be written as visuals, never marked as dialogue or narration',
    },
  },
  rhythm: {
    breath: { label: 'Breath', hint: 'Ease in, open up, settle down; good for setup and lyrical moments' },
    heartbeat: { label: 'Heartbeat', hint: 'Short and accelerating; good for conflict and standoffs' },
    wave: { label: 'Wave', hint: 'Builds layer by layer then releases; good for climaxes' },
    elastic: { label: 'Elastic time', hint: 'Stretch the key action, compress the rest' },
    pulse: { label: 'Pulse', hint: 'Steady beat; good for beat-synced cuts and ensemble shots' },
    silence_hammer: { label: 'Silence hammer', hint: 'Quiet build-up then a hard cut; good for twists' },
  },
  promptEditor: {
    assetInitial: 'A',
    durationChipTitle: 'Duration {seconds}s — click to change while editing',
  },
  scriptValidate: {
    segmentRange: 'Each @duration must be between {min} and {max} seconds',
    segmentOverSuggest: 'Some @duration values exceed the recommended {max}s for new shots; older drafts can still be generated',
    totalOverHard: 'This shot’s @duration total is {total}s, above the Seedance limit of {max}s',
    totalOverSuggest:
      'This shot’s @duration total is {total}s, above the recommended {max}s for new shots (older drafts can still be generated)',
    visualAsVoice:
      'An empty shot/shot size is marked as dialogue or narration (it would be voiced and subtitled). Rewrite it as a visual-only line, e.g. “Empty shot: …”',
    missingImage: 'These assets have no reference image; generation may auto-fill images or be unstable: {names}',
    missingVoice: 'The script has dialogue, but these characters have no voice bound yet: {names}',
    mustFix: '[Must fix first]',
    shouldFix: '[Recommended, you can still continue]',
  },
  segment: {
    totalOver: 'Total shot duration can’t exceed {max} seconds (currently {total}s)',
    placeholderBgm: '【BGM: post-mixed · upbeat and professional, quieter than the voice】',
    placeholderVisual: 'Over-the-shoulder shot of someone working at a desk…',
    placeholderNarration: 'Voice-over text…',
  },
  subtitle: {
    empty: 'No subtitles to export yet',
    narration: 'Narration',
    innerMonologue: 'Inner monologue',
    speakerSep: ': ',
  },
  genQueue: {
    assetTitle: 'Asset {id}',
    videoTitle: 'Video {id}',
    segmentLabel: 'Segment {n}',
    fragmentVideo: 'Shot video',
    canvasVideo: 'Canvas video',
    imageRunning: 'Generating image',
    videoRunning: 'Generating video',
    queued: 'Queued',
    generating: 'Generating',
    refImages: 'Generating reference images…',
    enqueued: 'Added to queue',
    interrupted: 'Task was interrupted, please generate again',
    cancelled: 'Cancelled',
    assetNotFound: 'Asset not found',
    imageCancelled: 'Image generation cancelled',
    imageFailed: 'Image generation failed',
    imageTimeout: 'Image generation timed out, refresh and try again',
    videoFailed: 'Video generation failed',
    videoTimeout: 'Video generation timed out, refresh and try again',
  },
  genOptions: {
    auto: 'Auto',
    imageModel: 'Image model',
    videoModel: 'Video model',
  },
  steps: {
    outline: 'Outline',
    storyboard: 'Storyboard',
    video: 'Generate video',
  },
  usage: {
    calls: '{n} calls',
    images: '{n} images',
    videos: '{n} videos',
  },
  workflow: {
    freeCanvas: 'Free canvas',
    cardCanvas: 'Free canvas · {n} node assets',
    cardScript: 'Script written · {episodes} episodes · {assets} assets',
    cardDraft: 'Draft · script pending · {n} assets',
  },
  imageStyles: {
    'retro-sci-fi-atompunk': 'Retro sci-fi atompunk',
    'palace-intrigue-cold': 'Cold palace intrigue',
    'domestic-suspense-cold': 'Cold-toned Chinese suspense',
    'ancient-romance-soft': 'Soft-lit period romance',
    'ancient-chinese-mythology': 'Ancient Chinese mythology epic',
    'japanese-youth-film': 'Japanese youth film',
    'japanese-daily-natural': 'Natural Japanese slice of life',
    'korean-urban-soft': 'Soft-lit Korean drama urban',
    'chinese-urban-realistic': 'Realistic Chinese urban',
    'wuxia-realistic-photo': 'Realistic wuxia photography',
    '90s-realistic-film': '90s realistic film',
    'retro-narrative-film': 'Retro narrative film',
    'american-retro-hollywood': 'Retro American Hollywood',
    'neon-cyberpunk-film': 'Neon cyberpunk film',
    '90s-rural-china-film': '90s rural China film',
    'cgi-3d-animation': '3D animation',
    'ghibli-handdrawn-anime': 'Ghibli-style hand-drawn',
    'tezuka-era-cartoon': 'Tezuka-era cartoon',
    'shanghai-animation': 'Shanghai Animation Studio style',
    'pixel-art': 'Pixel art',
    'shadow-puppet-illustration': 'Shadow puppet illustration',
  },
  genError: {
    failedTitle: 'Generation failed',
    shortSuggestion: 'Follow the hint above, then generate this shot again.',
    fallbackSuggestion: 'Check this shot’s reference images and script, then try again.',
    namedSlot: '{kind} “{name}”',
    slot: {
      character: 'Character',
      scene: 'Scene',
      prop: 'Prop',
      narration: 'Narration',
      refImage: 'Reference image',
      voice: 'Voice',
    },
    empty: {
      message: 'The task didn’t finish and no specific error was recorded.',
      suggestion:
        'Try again later. If it keeps failing, check that your network/proxy can reach TokenFree and that the model channel keys in Admin are valid.',
    },
    timeout: {
      title: 'Upstream response timed out',
      suggestion:
        'TokenFree was reached, but image/video generation took longer than the limit. Try again later; if text works and only images/videos time out, the upstream queue is probably slow rather than your proxy being down.',
    },
    network: {
      title: 'Can’t connect to the image/video service',
      suggestion:
        'This machine can’t reach the upstream service (often a proxy block or network outage). Check your network/proxy, try again, and make sure the TokenFree channel key in Admin is valid.',
    },
    imageFailed: {
      title: 'Image generation failed',
      message:
        'Image generation didn’t succeed, but this older task didn’t save a reason (usually an upstream connection failure with an empty error).',
      suggestion:
        'Generate again — the new version records a clear error. If it still fails, check the TokenFree network and keys.',
    },
    upstreamAccount: {
      title: 'Platform upstream account overdue',
      message:
        'The upstream Seedream model account has insufficient balance, so the image request was rejected. This is the site’s upstream account, not your personal wallet.',
      suggestion: 'Ask the site admin to top up in the TokenFree console, then try generating again.',
    },
    billing: {
      title: 'Insufficient balance',
      message: 'Your balance is too low to continue generating.',
      suggestion: 'Top up, then retry this task.',
    },
    realPerson: {
      title: 'Reference image may show a real person',
      namedMessage:
        'The video service’s review rejected this: the reference image for {kind} “{name}” may contain a real person’s likeness, so generation was refused.',
      namedSuggestion:
        'Open “{name}” in the assets panel on the left, regenerate or upload an anime/illustration-style look, then generate this shot again.',
      whereIndex: ' (submitted item {n} / content[{idx}], usually a character or scene reference image)',
      whereAny: ' (one of the reference images)',
      message:
        'The video service’s review rejected this: an input image{where} may contain a real person’s likeness, so generation was refused.',
      suggestion:
        'Open the assets panel and regenerate an anime/illustration-style look for the related characters/scenes with AI (avoid real photos), or upload a compliant image, then generate this shot again.',
    },
    retryLimit: {
      title: 'Still failing after several attempts',
      suggestion:
        'Automatic retries within this task were used up — you can still generate again. Fix the real cause (often a real-person check on a reference image) in your assets or script, then generate again.',
    },
    prevShot: {
      title: 'Can’t continue from the previous shot',
      message:
        'This shot continues from the previous shot’s last frame, but the previous shot failed, so this one didn’t start.',
      suggestion: 'Fix and regenerate the failed previous shot first, then generate the following segments in order.',
    },
    storyboardChanged: {
      title: 'Storyboard updated',
      message: 'The storyboard was saved or re-split during generation, so the old task is no longer valid.',
      suggestion: 'Go back to the episode page and generate from the current shot list; don’t retry the old task.',
    },
    textSensitive: {
      title: 'Text failed moderation',
      message: 'The shot script or prompt triggered content safety moderation.',
      suggestion: 'Edit the sensitive wording in the shot and try again.',
    },
    audioDownload: {
      title: 'Can’t download reference audio',
      message: 'The voice reference file URL is invalid or temporarily unavailable.',
      suggestion: 'Check the preview audio bound to the character, then regenerate or change the voice and try again.',
    },
    audioShort: {
      title: 'Reference audio too short',
      whereIndex: 'submitted item {n} / content[{idx}] (reference audio, not an image)',
      whereAny: 'a character/narration voice',
      message: 'The video service needs reference audio of at least 1.8 seconds; this one is too short: {where}.',
      suggestion:
        'Open the matching character or narration asset on the left, regenerate/upload a longer preview audio (≥ 2 seconds recommended), then generate this shot again. This isn’t a reference image problem.',
    },
    aspect: {
      title: 'Incompatible aspect ratio',
      message: 'With a single first frame, this video channel’s image-to-video may reject a fixed aspect ratio.',
      suggestion: 'Generate this shot again; the server will adapt the aspect ratio to the reference image.',
    },
    credits: {
      title: 'Video channel out of credits',
      message:
        'The upstream account doesn’t have enough credits to create a video task (not a reference image or audio length issue).',
      suggestion: 'Ask an admin to top up in the TokenFree console, then generate this shot again.',
    },
    fileType: {
      title: 'Unsupported reference image format',
      message:
        'The upstream rejected a reference image: File type not supported (usually an SVG placeholder or non-bitmap image).',
      suggestion:
        'Make sure the character/scene/prop covers used in this shot are PNG/JPG/WEBP. If one is still an SVG placeholder, regenerate or upload a bitmap for that asset, then generate the video.',
    },
    rejected: {
      title: 'Video service rejected the request',
      whereNamed: ' ({where})',
      whereIndex: ' (submitted item {n} / content[{idx}])',
      message: 'The upstream reported a parameter or content error and couldn’t create the task{where}.',
      suggestion:
        'Check this shot’s reference images, reference audio length (≥ 1.8 seconds) and script, then try again. If it keeps failing, contact support with the task ID.',
    },
    videoFailed: {
      title: 'Video generation failed',
      suggestion: 'Retry this shot later; if it keeps failing, change the reference images or simplify the script.',
    },
    skipped: {
      title: 'Old task skipped',
      message: 'The scheduler found this shot already has a video, so it cancelled this duplicate queued task.',
      suggestion:
        'If you were regenerating, check whether a new task is still running in the queue; if not, click regenerate again. This old cancellation isn’t a current failure.',
    },
    cancelled: {
      title: 'Cancelled',
      suggestion: 'Queue it again when you need the video.',
    },
    interrupted: {
      title: 'Task interrupted',
    },
  },
}
