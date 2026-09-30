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
import ActivityIcon from '@lucide/svelte/icons/activity'
import AlarmClockIcon from '@lucide/svelte/icons/alarm-clock'
import ArrowDownIcon from '@lucide/svelte/icons/arrow-down'
import ArrowUpIcon from '@lucide/svelte/icons/arrow-up'
import BellIcon from '@lucide/svelte/icons/bell'
import BellRingIcon from '@lucide/svelte/icons/bell-ring'
import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days'
import ChartColumnIcon from '@lucide/svelte/icons/chart-column'
import ChevronDownIcon from '@lucide/svelte/icons/chevron-down'
import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left'
import ChevronUpIcon from '@lucide/svelte/icons/chevron-up'
import CircleCheckIcon from '@lucide/svelte/icons/circle-check'
import ClipboardIcon from '@lucide/svelte/icons/clipboard'
import ClockIcon from '@lucide/svelte/icons/clock'
import CreditCardIcon from '@lucide/svelte/icons/credit-card'
import DicesIcon from '@lucide/svelte/icons/dices'
import EyeIcon from '@lucide/svelte/icons/eye'
import EyeOffIcon from '@lucide/svelte/icons/eye-off'
import FlameIcon from '@lucide/svelte/icons/flame'
import GlobeIcon from '@lucide/svelte/icons/globe'
import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical'
import HashIcon from '@lucide/svelte/icons/hash'
import Heading1Icon from '@lucide/svelte/icons/heading-1'
import Heading2Icon from '@lucide/svelte/icons/heading-2'
import Heading3Icon from '@lucide/svelte/icons/heading-3'
import HeartPulseIcon from '@lucide/svelte/icons/heart-pulse'
import HistoryIcon from '@lucide/svelte/icons/history'
import HourglassIcon from '@lucide/svelte/icons/hourglass'
import HouseIcon from '@lucide/svelte/icons/house'
import IdCardIcon from '@lucide/svelte/icons/id-card'
import ImagesIcon from '@lucide/svelte/icons/images'
import InfoIcon from '@lucide/svelte/icons/info'
import KeyRoundIcon from '@lucide/svelte/icons/key-round'
import KeyboardIcon from '@lucide/svelte/icons/keyboard'
import LayoutDashboardIcon from '@lucide/svelte/icons/layout-dashboard'
import ListIcon from '@lucide/svelte/icons/list'
import ListOrderedIcon from '@lucide/svelte/icons/list-ordered'
import LockKeyholeIcon from '@lucide/svelte/icons/lock-keyhole'
import LockOpenIcon from '@lucide/svelte/icons/lock-open'
import MinusIcon from '@lucide/svelte/icons/minus'
import MusicIcon from '@lucide/svelte/icons/music'
import PaletteIcon from '@lucide/svelte/icons/palette'
import PauseIcon from '@lucide/svelte/icons/pause'
import PillIcon from '@lucide/svelte/icons/pill'
import PlayIcon from '@lucide/svelte/icons/play'
import QuoteIcon from '@lucide/svelte/icons/quote'
import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw'
import ShieldIcon from '@lucide/svelte/icons/shield'
import ShieldCheckIcon from '@lucide/svelte/icons/shield-check'
import SparklesIcon from '@lucide/svelte/icons/sparkles'
import SquareKanbanIcon from '@lucide/svelte/icons/square-kanban'
import StickyNoteIcon from '@lucide/svelte/icons/sticky-note'
import TableIcon from '@lucide/svelte/icons/table'
import TimerIcon from '@lucide/svelte/icons/timer'
import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
import TypeIcon from '@lucide/svelte/icons/type'
import UserIcon from '@lucide/svelte/icons/user'
import Volume2Icon from '@lucide/svelte/icons/volume-2'
import VolumeXIcon from '@lucide/svelte/icons/volume-x'
import WifiIcon from '@lucide/svelte/icons/wifi'

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
  activity: ActivityIcon,
  'alarm-clock': AlarmClockIcon,
  'arrow-down': ArrowDownIcon,
  'arrow-up': ArrowUpIcon,
  bell: BellIcon,
  'bell-ring': BellRingIcon,
  'calendar-days': CalendarDaysIcon,
  'chart-column': ChartColumnIcon,
  'chevron-down': ChevronDownIcon,
  'chevron-left': ChevronLeftIcon,
  'chevron-up': ChevronUpIcon,
  'circle-check': CircleCheckIcon,
  clipboard: ClipboardIcon,
  clock: ClockIcon,
  'credit-card': CreditCardIcon,
  dices: DicesIcon,
  eye: EyeIcon,
  'eye-off': EyeOffIcon,
  flame: FlameIcon,
  globe: GlobeIcon,
  'grip-vertical': GripVerticalIcon,
  hash: HashIcon,
  'heading-1': Heading1Icon,
  'heading-2': Heading2Icon,
  'heading-3': Heading3Icon,
  'heart-pulse': HeartPulseIcon,
  history: HistoryIcon,
  hourglass: HourglassIcon,
  house: HouseIcon,
  'id-card': IdCardIcon,
  images: ImagesIcon,
  info: InfoIcon,
  'key-round': KeyRoundIcon,
  keyboard: KeyboardIcon,
  'layout-dashboard': LayoutDashboardIcon,
  list: ListIcon,
  'list-ordered': ListOrderedIcon,
  'lock-keyhole': LockKeyholeIcon,
  'lock-open': LockOpenIcon,
  minus: MinusIcon,
  music: MusicIcon,
  palette: PaletteIcon,
  pause: PauseIcon,
  pill: PillIcon,
  play: PlayIcon,
  quote: QuoteIcon,
  'refresh-cw': RefreshCwIcon,
  shield: ShieldIcon,
  'shield-check': ShieldCheckIcon,
  sparkles: SparklesIcon,
  'square-kanban': SquareKanbanIcon,
  'sticky-note': StickyNoteIcon,
  table: TableIcon,
  timer: TimerIcon,
  'triangle-alert': TriangleAlertIcon,
  type: TypeIcon,
  user: UserIcon,
  'volume-2': Volume2Icon,
  'volume-x': VolumeXIcon,
  wifi: WifiIcon,
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
