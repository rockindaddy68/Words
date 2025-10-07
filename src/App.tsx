import { useState } from 'react'

interface Song {
  title: string;
  artist: string;
  lyrics: string;
}

function App() {
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentSong, setCurrentSong] = useState<Song | null>(null)

  const searchLyrics = async () => {
    if (!searchQuery.trim()) return

    setIsLoading(true)
    setCurrentSong(null) // Clear previous results
    try {
      // Placeholder für API-Integration
      setTimeout(() => {
        setCurrentSong({
          title: "Blinding Lights",
          artist: "The Weeknd", 
          lyrics: `I feel like I'm just missing
Something when you're gone
'Cause you were all I had left
But I know you're not listening

I've been running through the jungle
I've been running with the wolves
To get to you, to get to you
I've been down the darkest alleys
Saw the dark side of the moon
To get to you, to get to you

I've looked everywhere for you
I've been running through the jungle
I've been crying in the rain
To get to you, to get to you

I'm just running to your heart
Till you show me how to dance
I been running all my life
To get to you, to get to you

[Demo lyrics - Connect to Genius or Musixmatch API for real lyrics]`
        })
        setIsLoading(false)
      }, 1200)
    } catch (error) {
      console.error('Error fetching lyrics:', error)
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-spotify-dark text-white font-spotify">
      {/* Header with gradient */}
      <div className="bg-gradient-to-b from-accent-600 via-accent-700 to-spotify-dark pb-8">
        <div className="container mx-auto px-6 pt-12">
          <div className="text-center animate-fade-in">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-12 h-12 bg-accent-500 rounded-full flex items-center justify-center text-2xl animate-pulse-slow">
                🎵
              </div>
              <h1 className="text-6xl font-bold bg-gradient-to-r from-white to-accent-100 bg-clip-text text-transparent">
                Lyrics Finder
              </h1>
            </div>
            <p className="text-xl text-accent-100 max-w-md mx-auto">
              Discover the words behind your favorite songs
            </p>
          </div>

          {/* Search Section */}
          <div className="max-w-2xl mx-auto mt-12 animate-slide-up">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for any song or artist..."
                className="w-full px-6 py-4 bg-spotify-card border border-spotify-hover rounded-full text-white placeholder-gray-400 focus:outline-none focus:border-accent-500 focus:ring-4 focus:ring-accent-500/20 transition-all duration-300 text-lg"
                onKeyPress={(e) => e.key === 'Enter' && searchLyrics()}
              />
              <button
                onClick={searchLyrics}
                disabled={isLoading || !searchQuery.trim()}
                className="absolute right-2 top-2 bottom-2 px-8 bg-accent-500 text-white rounded-full hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 font-semibold flex items-center gap-2 transform hover:scale-105"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Searching...
                  </>
                ) : (
                  <>
                    🔍 Search
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="container mx-auto px-6 py-8">
        {currentSong && (
          <div className="max-w-4xl mx-auto animate-fade-in">
            {/* Song Header */}
            <div className="bg-spotify-card rounded-2xl p-8 mb-6 border border-spotify-hover">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-gradient-to-br from-accent-500 to-secondary-500 rounded-2xl flex items-center justify-center text-3xl shadow-lg">
                  🎤
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">{currentSong.title}</h2>
                  <p className="text-xl text-accent-300 font-medium">by {currentSong.artist}</p>
                  <div className="flex gap-4 mt-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-accent-500/20 text-accent-300 rounded-full hover:bg-accent-500/30 transition-colors">
                      ❤️ Like
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-secondary-500/20 text-secondary-300 rounded-full hover:bg-secondary-500/30 transition-colors">
                      📤 Share
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Lyrics Display */}
            <div className="bg-spotify-card rounded-2xl border border-spotify-hover overflow-hidden">
              <div className="bg-gradient-to-r from-accent-500/10 to-secondary-500/10 px-8 py-4 border-b border-spotify-hover">
                <h3 className="text-lg font-semibold text-accent-300">Lyrics</h3>
              </div>
              <div className="p-8">
                <pre className="whitespace-pre-wrap text-gray-300 leading-loose text-lg font-light">
                  {currentSong.lyrics}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!currentSong && !isLoading && (
          <div className="text-center mt-20 animate-fade-in">
            <div className="w-32 h-32 bg-gradient-to-br from-accent-500/20 to-secondary-500/20 rounded-full flex items-center justify-center text-5xl mb-6 mx-auto">
              🎼
            </div>
            <h3 className="text-2xl font-bold text-gray-300 mb-3">Ready to find some lyrics?</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              Enter any song title or artist name in the search bar above and discover the words behind the music.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default App