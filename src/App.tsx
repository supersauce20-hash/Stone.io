import { useState, useEffect } from 'react';
import { 
  auth, 
  db, 
  onAuthStateChanged, 
  signOut,
  User 
} from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { UserStats } from './types';
import AuthPanel from './components/AuthPanel';
import SnakeCustomizer from './components/SnakeCustomizer';
import GameStage from './components/GameStage';
import GlobalLeaderboard from './components/GlobalLeaderboard';
import { Swords, ShieldAlert } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [playing, setPlaying] = useState(false);
  const [selectedName, setSelectedName] = useState('Anonymous');
  const [selectedSkin, setSelectedSkin] = useState('classic_blue');

  // Listen to Auth State Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Authenticated! Fetch stats or create default profile schema
        await loadUserProfile(currentUser);
      } else {
        setStats(null);
        setPlaying(false);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loadUserProfile = async (currentUser: User) => {
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const snap = await getDoc(userRef);

      if (snap.exists()) {
        const data = snap.data();
        setStats({
          uid: currentUser.uid,
          nickname: data.nickname || currentUser.displayName || 'Anonymous',
          highScore: data.highScore || 0,
          longestLength: data.longestLength || 10,
          totalKills: data.totalKills || 0,
          totalGames: data.totalGames || 0,
          coins: data.coins !== undefined ? data.coins : 150, // 150 startup bonus coins
          selectedSkin: data.selectedSkin || 'classic_blue',
          unlockedSkins: data.unlockedSkins || ['classic_blue', 'classic_red', 'classic_green'],
          unlockedAchievements: data.unlockedAchievements || [],
          updatedAt: data.updatedAt || new Date().toISOString(),
        });
      } else {
        // First-time Registering User, build new Firestore Document
        const defaultName = currentUser.isAnonymous 
          ? `Guest_${Math.random().toString(36).substring(2, 6)}` 
          : (currentUser.displayName || currentUser.email?.split('@')[0] || 'Anonymous');

        const defaultStats: UserStats = {
          uid: currentUser.uid,
          nickname: defaultName,
          highScore: 0,
          longestLength: 10,
          totalKills: 0,
          totalGames: 0,
          coins: 150,
          selectedSkin: 'classic_blue',
          unlockedSkins: ['classic_blue', 'classic_red', 'classic_green'],
          unlockedAchievements: [],
          updatedAt: new Date().toISOString(),
        };

        await setDoc(userRef, defaultStats);
        setStats(defaultStats);
      }
    } catch (err) {
      console.warn('Configuring localStorage sandbox fallback for profile stats:', err);
      // Fallback for offline/local constraints
      const localProfile = localStorage.getItem(`slither_stats_${currentUser.uid}`);
      if (localProfile) {
        setStats(JSON.parse(localProfile));
      } else {
        const fallbackStats: UserStats = {
          uid: currentUser.uid,
          nickname: currentUser.displayName || 'Guest Snake',
          highScore: 0,
          longestLength: 10,
          totalKills: 0,
          totalGames: 0,
          coins: 150,
          selectedSkin: 'classic_blue',
          unlockedSkins: ['classic_blue', 'classic_red', 'classic_green'],
          unlockedAchievements: [],
          updatedAt: new Date().toISOString(),
        };
        localStorage.setItem(`slither_stats_${currentUser.uid}`, JSON.stringify(fallbackStats));
        setStats(fallbackStats);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error(err);
    }
  };

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white gap-3">
        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs uppercase font-extrabold tracking-widest text-cyan-500 animate-pulse">Syncing User Sessions...</p>
      </div>
    );
  }

  // Auth panel
  if (!user || !stats) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center py-10 px-4">
        {/* Aesthetic design heading */}
        <div className="flex items-center gap-2 mb-6">
          <Swords className="w-8 h-8 text-cyan-400 animate-pulse" />
          <span className="text-lg font-black tracking-widest text-slate-400 uppercase">Slither Battleground</span>
        </div>
        <AuthPanel onAuthSuccess={() => {}} />
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-[#020617] text-slate-100 flex flex-col items-center py-8 px-4 font-sans select-none overflow-x-hidden"
      style={{
        backgroundImage: 'radial-gradient(circle at 0% 0%, #1e1b4b 0%, transparent 40%), radial-gradient(circle at 100% 100%, #312e81 0%, transparent 40%)'
      }}
    >
      {playing ? (
        <div className="w-full max-w-7xl animate-fade-in">
          <div className="flex justify-between items-center bg-slate-900/50 border border-slate-800 p-5 rounded-2xl mb-6 backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <Swords className="w-6 h-6 text-rose-500 animate-pulse shrink-0" />
              <div>
                <span className="text-white font-black text-sm block tracking-wide">Live Arena Battle</span>
                <span className="text-xs text-rose-400 font-mono italic">Opponent count: 15 active bots + online snakes</span>
              </div>
            </div>
            <button
              onClick={() => setPlaying(false)}
              className="text-xs font-black bg-slate-800/80 hover:bg-slate-700 text-white px-4 py-2 rounded-xl border border-slate-750 transition-all cursor-pointer uppercase tracking-wider"
            >
              🏳️ Quit Arena
            </button>
          </div>

          <GameStage
            stats={stats}
            playerName={selectedName}
            playerSkinId={selectedSkin}
            onUpdateStats={(newStats) => {
              setStats(newStats);
              localStorage.setItem(`slither_stats_${stats.uid}`, JSON.stringify(newStats));
            }}
            onExitGame={() => setPlaying(false)}
          />
        </div>
      ) : (
        <div id="lobby-container" className="w-full max-w-6xl animate-fade-in space-y-6">
          {user.isAnonymous && (
            <div className="flex items-center gap-3 bg-purple-950/20 border border-purple-500/20 rounded-2xl p-4 text-xs text-purple-300 w-full max-w-6xl mx-auto backdrop-blur-sm">
              <ShieldAlert className="w-5 h-5 text-purple-400 shrink-0" />
              <span>
                Playing as an <b>Anonymous Guest</b>. Your unlocked progress will be kept locally. Sign in via Google to secure your spot on the Global Hall of Fame!
              </span>
            </div>
          )}

          <SnakeCustomizer
            stats={stats}
            onUpdateStats={(newStats) => {
              setStats(newStats);
              localStorage.setItem(`slither_stats_${stats.uid}`, JSON.stringify(newStats));
            }}
            onStartGame={(name, skin) => {
              setSelectedName(name);
              setSelectedSkin(skin);
              setPlaying(true);
            }}
            onLogout={handleLogout}
          />

          <GlobalLeaderboard />
        </div>
      )}
    </div>
  );
}
