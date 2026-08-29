import type { Component } from 'svelte'
import Archive from '@lucide/svelte/icons/archive'
import Bookmark from '@lucide/svelte/icons/bookmark'
import Boxes from '@lucide/svelte/icons/boxes'
import Braces from '@lucide/svelte/icons/braces'
import Calendar from '@lucide/svelte/icons/calendar'
import Check from '@lucide/svelte/icons/check'
import CheckSquare from '@lucide/svelte/icons/square-check-big'
import ChevronRight from '@lucide/svelte/icons/chevron-right'
import Code from '@lucide/svelte/icons/code'
import Copy from '@lucide/svelte/icons/copy'
import FileText from '@lucide/svelte/icons/file-text'
import Folder from '@lucide/svelte/icons/folder'
import FolderOpen from '@lucide/svelte/icons/folder-open'
import FolderPlus from '@lucide/svelte/icons/folder-plus'
import Image from '@lucide/svelte/icons/image'
import Inbox from '@lucide/svelte/icons/inbox'
import LayoutGrid from '@lucide/svelte/icons/layout-grid'
import Lightbulb from '@lucide/svelte/icons/lightbulb'
import Link from '@lucide/svelte/icons/link'
import Lock from '@lucide/svelte/icons/lock'
import MoreHorizontal from '@lucide/svelte/icons/ellipsis'
import Notebook from '@lucide/svelte/icons/notebook'
import PanelLeft from '@lucide/svelte/icons/panel-left'
import Pencil from '@lucide/svelte/icons/pencil'
import Pin from '@lucide/svelte/icons/pin'
import Plus from '@lucide/svelte/icons/plus'
import RotateCcw from '@lucide/svelte/icons/rotate-ccw'
import Search from '@lucide/svelte/icons/search'
import Settings from '@lucide/svelte/icons/settings'
import Star from '@lucide/svelte/icons/star'
import Tag from '@lucide/svelte/icons/tag'
import Trash from '@lucide/svelte/icons/trash-2'
import Rocket from '@lucide/svelte/icons/rocket'
import X from '@lucide/svelte/icons/x'

export type IconComponent = Component<{ size?: number | string; strokeWidth?: number; class?: string }>

/**
 * The icons the UI itself uses, plus the shortlist offered as folder icons.
 * These are statically imported so the bundler can tree-shake them; the full
 * ~1500-icon catalogue arrives as a lazily fetched sprite with the icon picker.
 */
export const ICONS: Record<string, IconComponent> = {
  archive: Archive,
  bookmark: Bookmark,
  boxes: Boxes,
  braces: Braces,
  calendar: Calendar,
  check: Check,
  'check-square': CheckSquare,
  'chevron-right': ChevronRight,
  code: Code,
  copy: Copy,
  'file-text': FileText,
  folder: Folder,
  'folder-open': FolderOpen,
  'folder-plus': FolderPlus,
  image: Image,
  inbox: Inbox,
  'layout-grid': LayoutGrid,
  lightbulb: Lightbulb,
  link: Link,
  lock: Lock,
  more: MoreHorizontal,
  notebook: Notebook,
  'panel-left': PanelLeft,
  pencil: Pencil,
  pin: Pin,
  plus: Plus,
  restore: RotateCcw,
  rocket: Rocket,
  search: Search,
  settings: Settings,
  star: Star,
  tag: Tag,
  trash: Trash,
  x: X,
} as unknown as Record<string, IconComponent>

/** Folder icon choices offered before the full picker exists. */
export const FOLDER_ICON_NAMES = [
  'folder',
  'inbox',
  'rocket',
  'code',
  'braces',
  'lightbulb',
  'bookmark',
  'star',
  'tag',
  'image',
  'calendar',
  'notebook',
  'boxes',
  'link',
] as const

export function resolveIcon(name: string): IconComponent | null {
  return ICONS[name] ?? null
}
