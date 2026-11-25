import { deepMergeMessages } from './deepMerge'
import { enExtra } from './en/extra'
import { enStudioExtra } from './en/studio_extra'
import { enDrama } from './en/drama'
import { enEpisode } from './en/episode'
import { enLib } from './en/lib'
import { enPages } from './en/pages'
import { enShell } from './en/shell'
import { enShortVideoCreate } from './en/shortVideoCreate'
import { enStudio } from './en/studio'

export const en = deepMergeMessages({
  ...enShell,
  ...enPages,
  shortVideoCreate: enShortVideoCreate,
  studio: enStudio,
  episode: enEpisode,
  drama: enDrama,
  lib: enLib,
}, { ...enExtra, ...enStudioExtra })
