export interface Song {
  id: string
  title: string
  artist: string
  previewUrl: string | null
}

export interface Challenge {
  id: string
  title: string
  description?: string
  songCount: number
  createdAt: string
  playCount: number
  visibility: 'public' | 'private' | 'restricted'
}

export interface ChallengeDetail extends Challenge {
  songs: Song[]
  creatorUid: string
  playlistUrl?: string
}
