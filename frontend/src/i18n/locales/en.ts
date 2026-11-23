import { enDrama } from './en/drama'
import { enEpisode } from './en/episode'
import { enLib } from './en/lib'
import { enPages } from './en/pages'
import { enShell } from './en/shell'
import { enStudio } from './en/studio'

export const en = {
  ...enShell,
  ...enPages,
  studio: enStudio,
  episode: enEpisode,
  drama: enDrama,
  lib: enLib,
}
