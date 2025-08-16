// Accommodation type constants
export const ACCOMMODATION_IDS = {
  DORM_3_BED: '25c2a846-926d-4ac8-9cbd-f03309883e22',
  DORM_6_BED: 'd30c5cf7-f033-449a-8cec-176b754db7ee',
  VAN_PARKING: '74d777b7-5268-4a8e-be22-b59eb8ba663d',
  YOUR_OWN_TENT: '4c37de6b-3982-4734-b048-02a7cc585d89',
  STAYING_WITH_SOMEBODY: 'e8e7b726-38d9-4243-aa8d-4dc4a6c79713',
} as const;

export const SINGLE_ROOMS = [
  'Microcabin Left', 
  'Microcabin Middle', 
  'Microcabin Right',
  'The Hearth', 
  'The Yurt', 
  'Valleyview Room', 
  'Writer\'s Room'
] as const;

export const UNLIMITED_ACCOMMODATION_TYPES = [
  'Van Parking', 
  'Your Own Tent', 
  'Staying with somebody'
] as const;

export const REASSIGNABLE_ACCOMMODATION_TYPES = [
  'Bell Tent',
  'Tipi',
  'Van Parking',
  'Your Own Tent', 
  'Staying with somebody'
] as const;

// Color mapping for accommodation types
export const ACCOMMODATION_COLOR_MAP = {
  bell_tent: ['bg-green-400/70', 'bg-green-500/70', 'bg-green-600/70', 'bg-emerald-400/70', 'bg-emerald-500/70', 'bg-emerald-600/70', 'bg-teal-500/70', 'bg-teal-600/70'],
  tipi: ['bg-blue-400/70', 'bg-blue-500/70', 'bg-blue-600/70', 'bg-sky-400/70', 'bg-sky-500/70', 'bg-sky-600/70', 'bg-cyan-500/70', 'bg-cyan-600/70'],
  single_room: ['bg-purple-400/70', 'bg-purple-500/70', 'bg-purple-600/70', 'bg-violet-400/70', 'bg-violet-500/70', 'bg-violet-600/70', 'bg-indigo-500/70', 'bg-indigo-600/70'],
  dorm: ['bg-orange-400/70', 'bg-orange-500/70', 'bg-orange-600/70', 'bg-amber-400/70', 'bg-amber-500/70', 'bg-amber-600/70', 'bg-yellow-500/70', 'bg-yellow-600/70'],
  van_parking: ['bg-red-400/70', 'bg-red-500/70', 'bg-red-600/70', 'bg-rose-400/70', 'bg-rose-500/70', 'bg-rose-600/70', 'bg-pink-500/70', 'bg-pink-600/70'],
  tent: ['bg-stone-400/70', 'bg-stone-500/70', 'bg-stone-600/70', 'bg-zinc-400/70', 'bg-zinc-500/70', 'bg-zinc-600/70', 'bg-gray-500/70', 'bg-gray-600/70'],
  staying: ['bg-slate-400/70', 'bg-slate-500/70', 'bg-slate-600/70', 'bg-gray-400/70', 'bg-gray-500/70', 'bg-neutral-400/70', 'bg-neutral-500/70', 'bg-neutral-600/70'],
  default: ['bg-blue-500/70', 'bg-green-500/70', 'bg-yellow-500/70', 'bg-purple-500/70', 'bg-pink-500/70', 'bg-indigo-500/70', 'bg-red-500/70', 'bg-orange-500/70']
} as const;