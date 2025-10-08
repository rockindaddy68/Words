import { useState } from 'react'

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

      // 2. Lyrics API - Mehrere Quellen und Strategien
      let lyrics = ''
      if (artist && title) {
        console.log(`📡 Fetching lyrics for: "${artist}" - "${title}"`)
        
        // Intelligente Titel-Varianten für maximale Trefferquote
        const titleVariants = [
          title, // Original
          title.replace(/\s*-?\s*(Remastered|Remaster|Live|Acoustic|Remix|Edit|Version|Mix|2009|2010|2011|2012|2013|2014|2015|2016|2017|2018|2019|2020|2021|2022|2023|2024|2025).*$/i, '').trim(),
          title.replace(/\s*\([^)]*\)/g, '').trim(), // Ohne Klammern
          title.replace(/\s*\[[^\]]*\]/g, '').trim(), // Ohne eckige Klammern
          title.split(' - ')[0].trim(), // Nur Teil vor dem Bindestrich
          title.split(' (')[0].trim(), // Nur Teil vor der Klammer
        ].filter((t, index, arr) => t && t.length > 2 && arr.indexOf(t) === index) // Unique und mindestens 3 Zeichen
        
        const artistVariants = [
          artist, // Original
          artist.replace(/^The\s+/i, ''), // "The Rolling Stones" -> "Rolling Stones"
          `The ${artist}`, // "Rolling Stones" -> "The Rolling Stones"
          // Spezielle Cases für bekannte Bands
          ...(artist.toLowerCase().includes('led zeppelin') ? ['Led Zeppelin', 'LedZeppelin'] : []),
          ...(artist.toLowerCase().includes('pink floyd') ? ['Pink Floyd', 'PinkFloyd'] : []),
          ...(artist.toLowerCase().includes('deep purple') ? ['Deep Purple', 'DeepPurple'] : []),
        ]
        
        // Mehrere bewährte Lyrics-APIs für maximale Abdeckung
        const apiSources = [
          // 1. lyrics.ovh - Sehr zuverlässig, große Datenbank
          {
            url: (a: string, t: string) => `https://api.lyrics.ovh/v1/${encodeURIComponent(a)}/${encodeURIComponent(t)}`,
            parseResponse: (data: any) => data.lyrics?.trim()
          },
          // 2. Genius-basierte API - Gute Alternative 
          {
            url: (a: string, t: string) => `https://lyrist.vercel.app/api/${encodeURIComponent(t)}/${encodeURIComponent(a)}`,
            parseResponse: (data: any) => data.lyrics?.trim() || data.song?.trim()
          },
          // 3. Lyrics.com ähnliche API
          {
            url: (a: string, t: string) => `https://api.textyl.co/api/lyrics?q=${encodeURIComponent(a + ' ' + t)}`,
            parseResponse: (data: any) => data.lyrics?.trim()
          },
        ]
        
        try {
          // Teste alle Kombinationen systematisch für maximale Erfolgsquote
          searchLoop: for (const apiSource of apiSources) {
            for (const artistVar of artistVariants) {
              for (const titleVar of titleVariants) {
                // Skip Duplikate
                if (!titleVar || !artistVar) continue
                
                try {
                  console.log(`🔄 Trying API with: "${artistVar}" - "${titleVar}"`)
                  const response = await fetch(apiSource.url(artistVar, titleVar))
                  
                  if (response.ok) {
                    const data = await response.json()
                    const foundLyrics = apiSource.parseResponse(data)
                    
                    // Validierung: Mindestlänge und sinnvoller Inhalt
                    if (foundLyrics && 
                        foundLyrics.length > 30 && 
                        !foundLyrics.toLowerCase().includes('not found') &&
                        !foundLyrics.toLowerCase().includes('error') &&
                        foundLyrics.split('\n').length > 3) { // Mehr als 3 Zeilen
                      
                      lyrics = foundLyrics
                      console.log(`✅ Lyrics found via API: "${artistVar}" - "${titleVar}"`)
                      break searchLoop
                    }
                  }
                } catch (apiError) {
                  console.log(`❌ API error for "${artistVar}" - "${titleVar}":`, apiError)
                }
                
                // Rate limiting - kleine Pause zwischen Requests
                await new Promise(resolve => setTimeout(resolve, 150))
              }
            }
          }
        } catch (e) {
          console.log('❌ General lyrics fetch failed:', e)
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

          {/* Search Section - Einfach und direkt */}
          <div className="max-w-2xl mx-auto mt-12 animate-slide-up">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for any song or artist... (e.g., 'Led Zeppelin Thank You')"
                className="w-full px-6 py-4 bg-spotify-card border border-spotify-hover rounded-full text-white placeholder-gray-400 focus:outline-none focus:border-accent-500 focus:ring-4 focus:ring-accent-500/20 transition-all duration-300 text-lg"
                onKeyPress={(e) => e.key === 'Enter' && searchLyrics()}
              />
              
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