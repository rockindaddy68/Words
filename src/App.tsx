import { useState, useEffect } from 'react'

interface Song {
  title: string;
  artist: string;
  lyrics: string;
  album?: string;
  albumCover?: string;
}

function App() {
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentSong, setCurrentSong] = useState<Song | null>(null)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [showDropdown, setShowDropdown] = useState(false)

  // Schließe Dropdown beim Klicken außerhalb
  useEffect(() => {
    const handleClickOutside = () => setShowDropdown(false)
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  // Spezielle Suche nur für Songs eines Artists
  const searchArtistSongs = async (artistName: string) => {
    try {
      const token = await getSpotifyToken()
      if (!token) return

      const response = await fetch(
        `https://api.spotify.com/v1/search?q=artist:"${encodeURIComponent(artistName)}"&type=track&limit=20`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      )

      if (response.ok) {
        const data = await response.json()
        const suggestions = []
        
        // Füge Artist-Info hinzu
        suggestions.push({
          type: 'artist',
          artist: artistName,
          title: `🎤 ${artistName} - Artist Info`,
          image: '',
          followers: 0
        })
        
        // Nur Songs von diesem exakten Artist
        if (data.tracks?.items) {
          data.tracks.items.forEach((track: any) => {
            // Strenge Filterung: Nur wenn der Artist exakt übereinstimmt
            if (track.artists[0]?.name.toLowerCase() === artistName.toLowerCase()) {
              suggestions.push({
                type: 'track',
                artist: track.artists[0].name,
                title: track.name,
                album: track.album?.name || '',
                image: track.album?.images[0]?.url || ''
              })
            }
          })
        }
        
        setSearchResults(suggestions)
        setShowDropdown(suggestions.length > 0)
      }
    } catch (error) {
      console.error('Artist songs search failed:', error)
    }
  }

  // Live-Suche für Vorschläge
  const searchSuggestions = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }

    try {
      const token = await getSpotifyToken()
      if (!token) return

      const suggestions = []
      
      // 1. Suche nach Artists (exakt)
      const artistResponse = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=artist&limit=5`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      )
      
      if (artistResponse.ok) {
        const artistData = await artistResponse.json()
        if (artistData.artists?.items) {
          for (const artist of artistData.artists.items.slice(0, 3)) {
            suggestions.push({
              type: 'artist',
              artist: artist.name,
              title: `🎤 Alle ${artist.name} Songs anzeigen`,
              image: artist.images[0]?.url || '',
              followers: artist.followers?.total || 0
            })
            
            // 2. Für jeden gefundenen Artist: Hole seine Top-Tracks
            try {
              const tracksResponse = await fetch(
                `https://api.spotify.com/v1/search?q=artist:"${artist.name}"&type=track&limit=10`,
                { headers: { 'Authorization': `Bearer ${token}` } }
              )
              
              if (tracksResponse.ok) {
                const tracksData = await tracksResponse.json()
                if (tracksData.tracks?.items) {
                  tracksData.tracks.items.slice(0, 8).forEach((track: any) => {
                    // Nur Tracks von diesem Artist hinzufügen
                    if (track.artists[0]?.name.toLowerCase() === artist.name.toLowerCase()) {
                      suggestions.push({
                        type: 'track',
                        artist: track.artists[0].name,
                        title: track.name,
                        album: track.album?.name || '',
                        image: track.album?.images[0]?.url || ''
                      })
                    }
                  })
                }
              }
            } catch (e) {
              console.log('Track search failed for artist:', artist.name)
            }
          }
        }
      }
      
      // 3. Immer auch nach Tracks suchen (für Song-Titel wie "Tiny Dancer")
      const trackResponse = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=15`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      )
      
      if (trackResponse.ok) {
        const trackData = await trackResponse.json()
        if (trackData.tracks?.items) {
          trackData.tracks.items.forEach((track: any) => {
            // Verhindere Duplikate (falls der Track schon von Artist-Suche hinzugefügt wurde)
            const isDuplicate = suggestions.some(s => 
              s.type === 'track' && 
              s.artist === track.artists[0]?.name && 
              s.title === track.name
            )
            
            if (!isDuplicate) {
              suggestions.push({
                type: 'track',
                artist: track.artists[0]?.name || '',
                title: track.name,
                album: track.album?.name || '',
                image: track.album?.images[0]?.url || ''
              })
            }
          })
        }
      }
        
      setSearchResults(suggestions)
      setShowDropdown(suggestions.length > 0)
    } catch (error) {
      console.error('Suggestion search failed:', error)
    }
  }

  const parseSearchQuery = (query: string) => {
    // Format "Artist - Title" (eindeutig)
    const dashSplit = query.split(' - ');
    if (dashSplit.length === 2) {
      return { artist: dashSplit[0].trim(), title: dashSplit[1].trim() };
    }
    
    const words = query.trim().split(' ');
    
    // Intelligente Parsing-Strategien für alle möglichen Eingaben
    if (words.length >= 2) {
      // Strategie 1: Erstes Wort = Artist, Rest = Title (für einwörtige Artists wie Queen, Adele, etc.)
      const strategy1 = { 
        artist: words[0], 
        title: words.slice(1).join(' ') 
      };
      
      // Strategie 2: Erste zwei Wörter = Artist, Rest = Title (für mehrwörtige Artists)
      let strategy2 = null;
      if (words.length >= 3) {
        strategy2 = { 
          artist: words.slice(0, 2).join(' '), 
          title: words.slice(2).join(' ') 
        };
      }
      
      // Entscheidung: Bevorzuge einwörtige Artists bei kurzen Eingaben
      if (words.length === 2) {
        return strategy1; // "Queen Bohemian" -> Queen, Bohemian
      } else if (words.length === 3) {
        // Bei 3 Wörtern: Probiere beide Strategien
        return strategy1; // Bevorzuge "Queen Bohemian Rhapsody" -> Queen, Bohemian Rhapsody
      } else {
        // Bei 4+ Wörtern: Nutze 2-Wort-Artist als Standard
        return strategy2 || strategy1;
      }
    }
    
    // Fallback: Komplette Eingabe als Title
    return { artist: '', title: query.trim() };
  }

  const getSpotifyToken = async () => {
    try {
      const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
      const clientSecret = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET;
      
      if (!clientId || !clientSecret) {
        console.log('❌ Spotify credentials missing');
        return null;
      }

      console.log('🚀 Getting Spotify token...');
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
        },
        body: 'grant_type=client_credentials'
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Spotify token obtained');
        return data.access_token;
      }
      
      console.log('❌ Spotify token failed:', response.status);
      return null;
    } catch (error) {
      console.log('❌ Spotify error:', error);
      return null;
    }
  }

  const searchLyrics = async (selectedTrack?: { artist: string, title: string }) => {
    const query = selectedTrack ? `${selectedTrack.artist} ${selectedTrack.title}` : searchQuery
    if (!query.trim()) return

    setIsLoading(true)
    setCurrentSong(null)
    setShowDropdown(false)
    
    try {
      // Wenn ein Track ausgewählt wurde, nutze die exakten Daten
      let artist = selectedTrack?.artist || ''
      let title = selectedTrack?.title || ''
      let albumInfo = { album: "Unknown Album", albumCover: "https://via.placeholder.com/300x300/1f2937/10b981?text=🎵" }
      
      // 1. Wenn kein selectedTrack, suche zuerst auf Spotify für beste Matches
      if (!selectedTrack) {
        const token = await getSpotifyToken()
        if (token) {
          try {
            const spotifyResponse = await fetch(
              `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`,
              { headers: { 'Authorization': `Bearer ${token}` } }
            )
            
            if (spotifyResponse.ok) {
              const spotifyData = await spotifyResponse.json()
              const track = spotifyData.tracks?.items?.[0]
              
              if (track) {
                artist = track.artists[0]?.name || ''
                title = track.name || ''
                albumInfo = {
                  album: track.album?.name || "Unknown Album",
                  albumCover: track.album?.images[0]?.url || albumInfo.albumCover
                }
                console.log('✅ Spotify found:', title, 'by', artist)
              }
            }
          } catch (e) {
            console.log('❌ Spotify search failed:', e)
          }
        }
        
        // Fallback: Wenn Spotify nichts gefunden hat, nutze einfache Parsing
        if (!artist || !title) {
          const parsed = parseSearchQuery(query)
          artist = parsed.artist
          title = parsed.title
        }
      } else {
        // Für selectedTrack: Hole Album-Info von Spotify
        const token = await getSpotifyToken()
        if (token) {
          try {
            const spotifyResponse = await fetch(
              `https://api.spotify.com/v1/search?q=artist:"${artist}" track:"${title}"&type=track&limit=1`,
              { headers: { 'Authorization': `Bearer ${token}` } }
            )
            
            if (spotifyResponse.ok) {
              const spotifyData = await spotifyResponse.json()
              const track = spotifyData.tracks?.items?.[0]
              
              if (track) {
                albumInfo = {
                  album: track.album?.name || "Unknown Album", 
                  albumCover: track.album?.images[0]?.url || albumInfo.albumCover
                }
              }
            }
          } catch (e) {
            console.log('❌ Spotify album search failed:', e)
          }
        }
      }

      // 2. Lyrics API - Mehrere Quellen versuchen
      let lyrics = ''
      if (artist && title) {
        try {
          console.log(`📡 Fetching lyrics for: "${artist}" - "${title}"`)
          
          // Erste Quelle: lyrics.ovh
          let lyricsResponse = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`)
          
          if (lyricsResponse.ok) {
            const lyricsData = await lyricsResponse.json()
            if (lyricsData.lyrics && lyricsData.lyrics.trim()) {
              lyrics = lyricsData.lyrics.trim()
              console.log('✅ Lyrics found from lyrics.ovh')
            }
          }
          
          // Falls keine Lyrics gefunden: Versuche alternative Titel-Varianten
          if (!lyrics) {
            // Entferne Klammern und Zusätze wie "(Remastered)", "- Remastered", etc.
            const cleanTitle = title.replace(/\s*-?\s*(Remastered|Remaster|2009|2010|2011|2012|2013|2014|2015|2016|2017|2018|2019|2020|2021|2022|2023|2024|2025).*$/i, '')
                                   .replace(/\s*\([^)]*\)/g, '')
                                   .trim()
            
            if (cleanTitle !== title) {
              console.log(`🔄 Trying clean title: "${cleanTitle}"`)
              const cleanResponse = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(cleanTitle)}`)
              
              if (cleanResponse.ok) {
                const cleanData = await cleanResponse.json()
                if (cleanData.lyrics && cleanData.lyrics.trim()) {
                  lyrics = cleanData.lyrics.trim()
                  console.log('✅ Lyrics found with clean title')
                }
              }
            }
          }
          
        } catch (e) {
          console.log('❌ Lyrics fetch failed:', e)
        }
      }

      // 3. Ergebnis setzen
      setCurrentSong({
        title: title || query,
        artist: artist || 'Unknown Artist',
        lyrics: lyrics || `🔍 Keine Lyrics gefunden für "${query}"

Mögliche Gründe:
• Lyrics noch nicht verfügbar  
• Song zu neu oder unbekannt
• API-Probleme

💡 Tipp: Nutze die Dropdown-Vorschläge für bessere Ergebnisse!`,
        album: albumInfo.album,
        albumCover: albumInfo.albumCover
      })
    } catch (error) {
      console.error('Error fetching lyrics:', error)
    } finally {
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
              <h1 className="text-8xl font-bold bg-gradient-to-r from-white to-accent-100 bg-clip-text text-transparent">
                Words
              </h1>
            </div>
            <p className="text-xl text-accent-100 max-w-md mx-auto">
              Discover the lyrics behind your favorite songs
            </p>
          </div>

          {/* Search Section with Live Suggestions */}
          <div className="max-w-2xl mx-auto mt-12 animate-slide-up">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  searchSuggestions(e.target.value)
                }}
                placeholder="Type song title, artist name, or 'Queen' to see all Queen songs..."
                className="w-full px-6 py-4 bg-spotify-card border border-spotify-hover rounded-full text-white placeholder-gray-400 focus:outline-none focus:border-accent-500 focus:ring-4 focus:ring-accent-500/20 transition-all duration-300 text-lg"
                onKeyPress={(e) => e.key === 'Enter' && searchLyrics()}
                onFocus={() => searchSuggestions(searchQuery)}
              />
              
              {/* Live Dropdown Suggestions */}
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-spotify-card border border-spotify-hover rounded-2xl shadow-2xl z-50 max-h-96 overflow-y-auto">
                  <div className="p-4 border-b border-spotify-hover">
                    <div className="text-sm text-accent-300 font-medium">Found {searchResults.length} results for "{searchQuery}"</div>
                  </div>
                  {searchResults.map((result, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-4 p-4 hover:bg-spotify-hover cursor-pointer border-b border-spotify-hover/50 transition-colors"
                      onClick={() => {
                        if (result.type === 'track') {
                          setSearchQuery(`${result.artist} ${result.title}`)
                          setShowDropdown(false)
                          // Auto-search the selected track with exact data
                          setTimeout(() => searchLyrics({ artist: result.artist, title: result.title }), 100)
                        } else if (result.type === 'artist') {
                          setSearchQuery(result.artist)
                          // Zeige nur Songs von diesem Artist
                          setTimeout(() => searchArtistSongs(result.artist), 100)
                        }
                      }}
                    >
                      {result.image && (
                        <img 
                          src={result.image} 
                          alt={result.type === 'track' ? result.title : result.artist}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      )}
                      <div className="flex-1">
                        {result.type === 'track' ? (
                          <>
                            <div className="text-white font-medium">{result.title}</div>
                            <div className="text-gray-400 text-sm">by {result.artist}</div>
                            {result.album && <div className="text-gray-500 text-xs">{result.album}</div>}
                          </>
                        ) : (
                          <>
                            <div className="text-white font-medium">{result.artist}</div>
                            <div className="text-gray-400 text-sm">Artist • {result.followers?.toLocaleString()} followers</div>
                          </>
                        )}
                      </div>
                      <div className="text-accent-500">
                        {result.type === 'track' ? '🎵' : '🎤'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <button
                onClick={() => searchLyrics()}
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
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
                {/* Song Info - Links, 2/3 der Breite */}
                <div className="lg:col-span-2">
                  <h2 className="text-4xl lg:text-5xl font-bold text-white mb-3">{currentSong.title}</h2>
                  <p className="text-2xl lg:text-3xl text-accent-300 font-medium mb-4">by {currentSong.artist}</p>
                  
                  {currentSong.album && (
                    <div className="mb-6">
                      <h3 className="text-2xl font-bold text-white mb-2">💿 {currentSong.album}</h3>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-accent-500/20 text-accent-300 rounded-full hover:bg-accent-500/30 transition-colors text-sm">
                      ❤️ Like
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-secondary-500/20 text-secondary-300 rounded-full hover:bg-secondary-500/30 transition-colors text-sm">
                      📤 Share
                    </button>
                  </div>
                </div>

                {/* Album Cover - Rechts, 1/3 der Breite */}
                <div className="justify-self-center lg:justify-self-end">
                  <img 
                    src={currentSong.albumCover || "https://via.placeholder.com/300x300/1f2937/10b981?text=🎵"} 
                    alt={`${currentSong.album || 'Album'} cover`}
                    className="w-48 h-48 lg:w-56 lg:h-56 rounded-3xl shadow-2xl object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = "https://via.placeholder.com/300x300/1f2937/10b981?text=🎵";
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Lyrics Display - ENDLICH EINFACH! */}
            <div className="bg-spotify-card rounded-2xl p-8 border border-spotify-hover">
              <h3 className="text-white font-bold mb-4">Lyrics</h3>
              <div className="text-white leading-none">
                {currentSong.lyrics.split('\n').map((line, index) => (
                  <div key={index} style={{lineHeight: '1.2'}}>
                    {line.trim() || ' '}
                  </div>
                ))}
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