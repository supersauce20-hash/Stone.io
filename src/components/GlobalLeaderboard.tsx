import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { Trophy, ShieldAlert, Sparkles, RefreshCw, Star } from 'lucide-react';

interface LeaderboardRecord {
  id: string;
  nickname: string;
  highScore: number;
  longestLength: number;
  totalKills: number;
  skin: string;
  timestamp?: any;
}

export default function GlobalLeaderboard() {
  const [scores, setScores] = useState<LeaderboardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchGlobalLeaderboard = async () => {
    setLoading(true);
    setError('');
    try {
      const q = query(
        collection(db, 'leaderboard'),
        orderBy('highScore', 'desc'),
        limit(12)
      );
      const snapshot = await getDocs(q);
      const list: LeaderboardRecord[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          nickname: data.nickname || 'Anonymous',
          highScore: data.highScore || 0,
          longestLength: data.longestLength || 10,
          totalKills: data.totalKills || 0,
          skin: data.skin || 'classic_blue',
          timestamp: data.timestamp,
        });
      });

      // Filter out duplicates from the same userId if any, to keep it a pure highscore board
      const uniqueList: LeaderboardRecord[] = [];
      const seenNames = new Set<string>();
      list.forEach((item) => {
        if (!seenNames.has(item.nickname)) {
          seenNames.add(item.nickname);
          uniqueList.push(item);
        }
      });

      setScores(uniqueList.slice(0, 10));
    } catch (err: any) {
      console.warn('Could not read scoreboard. Displaying empty or demo scores.', err);
      setError('Live records temporarily offline. Play matches to register new scores!');
      // Populate beautiful localized demo accounts if empty Firestore
      setScores([
        { id: 'demo1', nickname: 'ChromaKing', highScore: 9480, longestLength: 632, totalKills: 42, skin: 'rainbow' },
        { id: 'demo2', nickname: 'NeonGlow', highScore: 6150, longestLength: 410, totalKills: 28, skin: 'neon_tron' },
        { id: 'demo3', nickname: 'GigaViper', highScore: 4890, longestLength: 326, totalKills: 19, skin: 'classic_red' },
        { id: 'demo4', nickname: 'SlipperySnake', highScore: 3200, longestLength: 213, totalKills: 14, skin: 'tiger_stripes' },
        { id: 'demo5', nickname: 'NoodleWiggle', highScore: 2450, longestLength: 163, totalKills: 9, skin: 'classic_green' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGlobalLeaderboard();
  }, []);

  return (
    <div id="leaderboard-section" className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between backdrop-blur-sm shadow-xl w-full max-w-6xl mx-auto mt-8 relative overflow-hidden">
      {/* Background radial-dot pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #94a3b8 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

      <div className="flex justify-between items-center mb-5 relative z-10">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-cyan-400" />
          <h3 className="text-sm font-black text-cyan-400 tracking-[0.2em] uppercase">Global Hall of Fame</h3>
        </div>
        <button
          onClick={fetchGlobalLeaderboard}
          title="Refresh Board"
          disabled={loading}
          className="p-2 text-slate-400 hover:text-slate-100 bg-slate-950/40 hover:bg-slate-950 border border-slate-800/40 rounded-lg transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-yellow-950/20 border border-yellow-800/20 rounded-xl p-3 text-[11px] text-yellow-300 mb-5 relative z-10">
          <ShieldAlert className="w-4 h-4 text-yellow-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Podium Visualization for first-class aesthetics */}
      <div className="grid grid-cols-3 max-w-md mx-auto items-end gap-3 mb-8 px-4 py-2 border-b border-slate-800/60 relative z-10">
        {/* Render Second Place */}
        {scores[1] && (
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-slate-300 truncate max-w-full text-center">{scores[1].nickname}</span>
            <span className="text-[10px] text-emerald-400 font-bold mb-1.5">{scores[1].highScore} pts</span>
            <div className="w-full bg-slate-900/60 h-16 rounded-t-xl flex flex-col justify-center items-center relative border border-slate-800">
              <span className="text-2xl font-black text-slate-300">2</span>
              <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider mt-0.5">Silver</span>
            </div>
          </div>
        )}

        {/* Render First Place */}
        {scores[0] && (
          <div className="flex flex-col items-center">
            <Star className="w-4 h-4 text-amber-400 animate-pulse mb-1" />
            <span className="text-xs font-black text-white truncate max-w-full text-center">{scores[0].nickname}</span>
            <span className="text-[11px] text-amber-400 font-bold mb-1.5">{scores[0].highScore} pts</span>
            <div className="w-full bg-slate-850/80 h-24 rounded-t-xl flex flex-col justify-center items-center relative border-t-2 border-amber-500 shadow-lg shadow-amber-500/5">
              <span className="text-3xl font-black text-amber-400">1</span>
              <span className="text-[9px] text-amber-500 uppercase font-black tracking-widest mt-0.5">GOLD</span>
            </div>
          </div>
        )}

        {/* Render Third Place */}
        {scores[2] && (
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-slate-400 truncate max-w-full text-center">{scores[2].nickname}</span>
            <span className="text-[10px] text-amber-600 font-bold mb-1.5">{scores[2].highScore} pts</span>
            <div className="w-full bg-slate-900/40 h-12 rounded-t-xl flex flex-col justify-center items-center relative border border-slate-800">
              <span className="text-xl font-black text-amber-700">3</span>
              <span className="text-[9px] text-amber-750 uppercase font-bold tracking-wider mt-0.5">Bronze</span>
            </div>
          </div>
        )}
      </div>

      {loading && scores.length === 0 ? (
        <div className="text-center text-slate-500 font-bold py-10 uppercase text-xs animate-pulse relative z-10">Syncing Scores...</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl relative z-10 border border-slate-800/80">
          <table className="w-full text-xs text-left text-slate-300 border-collapse">
            <thead className="text-[10px] bg-slate-950/60 text-slate-500 uppercase tracking-widest border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Rank</th>
                <th className="py-3 px-4">Snake Name</th>
                <th className="py-3 px-4">HighScore</th>
                <th className="py-3 px-4">Peak Length</th>
                <th className="py-3 px-4">Kills</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/10">
              {scores.map((record, index) => {
                const isGold = index === 0;
                const isSilver = index === 1;
                const isBronze = index === 2;

                return (
                  <tr
                    key={record.id}
                    className={`hover:bg-slate-800/30 transition-colors ${
                      isGold ? 'bg-amber-500/5' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4 font-black">
                      {isGold && <span className="text-amber-400">🏆 1st</span>}
                      {isSilver && <span className="text-slate-300">🥈 2nd</span>}
                      {isBronze && <span className="text-amber-600">🥉 3rd</span>}
                      {!isGold && !isSilver && !isBronze && <span className="text-slate-500">{index + 1}th</span>}
                    </td>
                    <td className="py-3.5 px-4 text-white font-bold">{record.nickname}</td>
                    <td className="py-3.5 px-4 font-bold text-amber-400 font-mono text-sm">{record.highScore}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">{record.longestLength}m</td>
                    <td className="py-3.5 px-4 text-rose-400 font-bold">{record.totalKills} kills</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
