import { useState, useEffect, useRef } from 'react';
import { SKINS, SkinStyle, ACHIEVEMENTS, UserStats } from '../types';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Trophy, Coins, Check, Lock, Palette, Signal, LogOut, Swords, Hash, Eye } from 'lucide-react';

interface SnakeCustomizerProps {
  stats: UserStats;
  onUpdateStats: (updated: UserStats) => void;
  onStartGame: (name: string, skinId: string) => void;
  onLogout: () => void;
}

export default function SnakeCustomizer({ stats, onUpdateStats, onStartGame, onLogout }: SnakeCustomizerProps) {
  const [nickname, setNickname] = useState(stats.nickname || 'Anoymous');
  const [selectedSkinId, setSelectedSkinId] = useState(stats.selectedSkin || 'classic_blue');
  const [feedback, setFeedback] = useState('');
  const [activeTab, setActiveTab] = useState<'arena' | 'skins' | 'achievements'>('arena');
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Synchronize initial prop to nickname state
  useEffect(() => {
    if (stats.nickname) {
       setNickname(stats.nickname);
    }
    if (stats.selectedSkin) {
       setSelectedSkinId(stats.selectedSkin);
    }
  }, [stats]);

  // Skin Canvas Preview Animation Loop
  useEffect(() => {
    let animationId: number;
    let t = 0;

    const renderPreview = () => {
      const canvas = previewCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const skinSelected = SKINS.find(s => s.id === selectedSkinId) || SKINS[0];
      const colors = skinSelected.colors;

      t += 0.08;
      const points = 15;
      const segmentRadius = 14;

      // Draw shadow
      ctx.shadowBlur = 10;
      ctx.shadowColor = colors[0] + '55';

      for (let i = points - 1; i >= 0; i--) {
        const x = 50 + i * 15;
        const y = canvas.height / 2 + Math.sin(t - i * 0.4) * 25;
        const color = colors[i % colors.length];

        ctx.fillStyle = color;
        ctx.beginPath();
        // Head is larger
        const r = i === 0 ? segmentRadius + 4 : segmentRadius - (i * 0.4);
        ctx.arc(x, y, Math.max(4, r), 0, Math.PI * 2);
        ctx.fill();

        // Draw animated small shiny eye on head
        if (i === 0) {
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(x + 5, y - 5, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.arc(x + 7, y - 5, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.shadowBlur = 0;
      animationId = requestAnimationFrame(renderPreview);
    };

    renderPreview();
    return () => cancelAnimationFrame(animationId);
  }, [selectedSkinId]);

  const handleSaveNickname = async () => {
    const trimmed = nickname.trim().slice(0, 16);
    if (!trimmed) return;

    try {
      const userRef = doc(db, 'users', stats.uid);
      await updateDoc(userRef, { nickname: trimmed });
      onUpdateStats({ ...stats, nickname: trimmed });
      setFeedback('Name saved successfully!');
      setTimeout(() => setFeedback(''), 3000);
    } catch (err) {
      // Local fallback for guest accounts or if Firestore offline
      onUpdateStats({ ...stats, nickname: trimmed });
      setFeedback('Name set locally!');
      setTimeout(() => setFeedback(''), 3000);
    }
  };

  const handleEquipSkin = async (skinId: string) => {
    try {
      const userRef = doc(db, 'users', stats.uid);
      await updateDoc(userRef, { selectedSkin: skinId });
      onUpdateStats({ ...stats, selectedSkin: skinId });
      setSelectedSkinId(skinId);
    } catch (err) {
      onUpdateStats({ ...stats, selectedSkin: skinId });
      setSelectedSkinId(skinId);
    }
  };

  const handlePurchaseSkin = async (skin: SkinStyle) => {
    if (stats.coins < skin.cost) {
      setFeedback("You don't have enough snake coins!");
      setTimeout(() => setFeedback(''), 3000);
      return;
    }

    const updatedUnlocked = [...stats.unlockedSkins, skin.id];
    const newCoins = stats.coins - skin.cost;

    try {
      const userRef = doc(db, 'users', stats.uid);
      await updateDoc(userRef, {
        unlockedSkins: updatedUnlocked,
        coins: newCoins
      });
      onUpdateStats({ ...stats, unlockedSkins: updatedUnlocked, coins: newCoins });
      setFeedback(`Custom Skin ${skin.name} Unlocked!`);
      setTimeout(() => setFeedback(''), 3000);
    } catch (err) {
      onUpdateStats({ ...stats, unlockedSkins: updatedUnlocked, coins: newCoins });
      setFeedback(`Custom Skin ${skin.name} Unlocked locally!`);
      setTimeout(() => setFeedback(''), 3000);
    }
  };

  return (
    <div id="customizer-container" className="flex flex-col bg-slate-900/30 text-white rounded-3xl border border-slate-800/80 shadow-2xl p-6 w-full max-w-6xl mx-auto backdrop-blur-md">
      {/* Header Banner - styled as Bento-compliant header */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-slate-900/50 border border-slate-800/80 p-6 rounded-2xl mb-8 gap-4 backdrop-blur-md shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <div className="w-4 h-4 bg-white rounded-full"></div>
          </div>
          <h1 className="text-3xl font-black tracking-tighter italic">SLITHER<span className="text-cyan-400 text-xl not-italic ml-1">.IO</span></h1>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 bg-slate-800/50 border border-slate-700/50 rounded-full py-2 pl-4 pr-4">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-xs font-black shadow-lg">
            {nickname.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-white">{nickname}</span>
            <span className="text-[10px] text-slate-400">All-Time High: {stats.highScore}</span>
          </div>
          <div className="h-4 w-[1px] bg-slate-700 mx-1"></div>
          <span className="text-xs font-mono text-emerald-400 font-bold">{stats.coins} COINS</span>
          <div className="h-4 w-[1px] bg-slate-700 mx-1"></div>
          <button
            onClick={onLogout}
            className="text-[10px] font-black text-rose-400 hover:text-rose-300 uppercase tracking-widest transition-colors cursor-pointer"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap border-b border-slate-800/80 mb-6 gap-2">
        <button
          onClick={() => setActiveTab('arena')}
          className={`px-5 py-3 font-black text-xs uppercase tracking-widest transition-all focus:outline-none cursor-pointer ${
            activeTab === 'arena' ? 'border-b-2 border-cyan-400 text-cyan-400' : 'text-slate-400 hover:text-slate-100'
          }`}
        >
          🎮 Arena Setup
        </button>
        <button
          onClick={() => setActiveTab('skins')}
          className={`px-5 py-3 font-black text-xs uppercase tracking-widest transition-all focus:outline-none cursor-pointer ${
            activeTab === 'skins' ? 'border-b-2 border-blue-400 text-blue-400' : 'text-slate-400 hover:text-slate-100'
          }`}
        >
          🎨 Skins Gallery
        </button>
        <button
          onClick={() => setActiveTab('achievements')}
          className={`px-5 py-3 font-black text-xs uppercase tracking-widest transition-all focus:outline-none cursor-pointer ${
            activeTab === 'achievements' ? 'border-b-2 border-amber-400 text-amber-400' : 'text-slate-400 hover:text-slate-100'
          }`}
        >
          🏆 Achievements ({stats.unlockedAchievements.length})
        </button>
      </div>

      {/* TAB CONTENT: ENTER ARENA */}
      {activeTab === 'arena' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Play Configuration */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-6 bg-slate-900/40 border border-slate-800/80 p-6 rounded-3xl relative overflow-hidden backdrop-blur-sm">
            {/* Background circular dotted bento panel pattern */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #94a3b8 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
            
            <div className="space-y-4 relative z-10">
              <h3 className="text-sm font-black text-cyan-400 mb-2 tracking-[0.2em] uppercase">Play Settings</h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  maxLength={16}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="ENTER NAME..."
                  className="w-full bg-slate-950/80 border-2 border-slate-700/60 rounded-2xl py-3 px-5 text-center text-lg font-bold tracking-widest focus:border-cyan-500 outline-none transition-colors uppercase placeholder:text-slate-600 focus:ring-1 focus:ring-cyan-500/20"
                />
                <button
                  onClick={handleSaveNickname}
                  className="bg-slate-800/80 border border-slate-700 hover:bg-slate-750 text-slate-300 font-bold px-6 py-3 rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer hover:border-slate-600 shrink-0"
                >
                  Save Nick
                </button>
              </div>
              {feedback && <div className="text-xs text-emerald-400 font-bold tracking-wider">{feedback}</div>}
            </div>

            {/* Interactive Preview Canvas with Neon glow borders! */}
            <div className="bg-slate-950/80 rounded-2xl border border-slate-800/90 p-4 relative flex flex-col items-center mt-4">
              <span className="absolute top-3 left-4 text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1.5 pointer-events-none">
                <Eye className="w-3.5 h-3.5 text-cyan-400" /> Skin Preview
              </span>
              <canvas
                ref={previewCanvasRef}
                width={360}
                height={120}
                className="w-full h-28 object-contain"
              />
            </div>

            {/* Launch Game Button */}
            <button
              onClick={() => onStartGame(nickname, selectedSkinId)}
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white py-5 rounded-2xl text-xl font-black tracking-widest shadow-xl shadow-cyan-900/40 transition-all active:scale-[0.98] cursor-pointer mt-4"
            >
              PLAY BATTLE GAME
            </button>
          </div>

          {/* Right Column: Lifetime Stats dashboard */}
          <div className="lg:col-span-5 bg-slate-900/40 border border-slate-800/80 p-6 rounded-3xl flex flex-col justify-between backdrop-blur-sm">
            <div>
              <h3 className="text-sm font-black text-amber-400 mb-4 tracking-[0.2em] uppercase">Personal Records</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-slate-850/40 p-4 rounded-xl border border-slate-800/50">
                  <div className="flex items-center gap-2.5 text-yellow-400">
                    <Trophy className="w-5 h-5 shrink-0" />
                    <span className="text-xs font-bold text-slate-400">All-Time High Score</span>
                  </div>
                  <span className="text-base font-black text-white font-mono">{stats.highScore}</span>
                </div>

                <div className="flex justify-between items-center bg-slate-850/40 p-4 rounded-xl border border-slate-800/50">
                  <div className="flex items-center gap-2.5 text-purple-400">
                    <Palette className="w-5 h-5 shrink-0" />
                    <span className="text-xs font-bold text-slate-400">Longest Logged Length</span>
                  </div>
                  <span className="text-base font-black text-white font-mono">{stats.longestLength}m</span>
                </div>

                <div className="flex justify-between items-center bg-slate-850/40 p-4 rounded-xl border border-slate-800/50">
                  <div className="flex items-center gap-2.5 text-red-400">
                    <Swords className="w-5 h-5 shrink-0" />
                    <span className="text-xs font-bold text-slate-400">Opponents Defeated</span>
                  </div>
                  <span className="text-base font-black text-white font-mono">{stats.totalKills} kills</span>
                </div>

                <div className="flex justify-between items-center bg-slate-850/40 p-4 rounded-xl border border-slate-800/50">
                  <div className="flex items-center gap-2.5 text-cyan-400">
                    <Hash className="w-5 h-5 shrink-0" />
                    <span className="text-xs font-bold text-slate-400">Matches Participated</span>
                  </div>
                  <span className="text-base font-black text-white font-mono">{stats.totalGames} sessions</span>
                </div>
              </div>
            </div>

            <div className="mt-5 text-center bg-cyan-950/20 rounded-xl border border-cyan-800/25 p-3 text-[10px] text-cyan-300/80 leading-relaxed">
              💡 <b>Arena Pro-tip:</b> Hold down left click or Spacebar to activate speed boost. Boosting sheds size into neon light points!
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: SKINS */}
      {activeTab === 'skins' && (
        <div>
          <h3 className="text-sm font-black text-blue-400 mb-4 tracking-[0.2em] uppercase">Skins Gallery</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {SKINS.map((skin) => {
              const isUnlocked = stats.unlockedSkins.includes(skin.id);
              const isSelected = selectedSkinId === skin.id;

              return (
                <div
                  key={skin.id}
                  className={`bg-slate-900/40 border p-5 rounded-3xl flex flex-col justify-between h-48 transition backdrop-blur-sm ${
                    isSelected ? 'border-cyan-500 ring-2 ring-cyan-500/20 bg-slate-900/60' : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-base text-white">{skin.name}</h4>
                      {isUnlocked ? (
                        <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider">
                          Owned
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] text-yellow-400 font-bold bg-yellow-500/10 px-2 py-0.5 rounded-md">
                          <Lock className="w-3 h-3" /> Unlocked
                        </span>
                      )}
                    </div>

                    {/* Multi-color bubbles */}
                    <div className="flex gap-1.5 mt-3">
                      {skin.colors.map((c, i) => (
                        <span
                          key={i}
                          className="w-4 h-4 rounded-full border border-slate-950 shrink-0 shadow-sm"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>

                    {skin.unlockRequirement && !isUnlocked && (
                      <p className="text-[10px] text-cyan-300 mt-2 font-mono italic">
                        Locked: {skin.unlockRequirement}
                      </p>
                    )}
                  </div>

                  <div className="mt-4">
                    {isUnlocked ? (
                      isSelected ? (
                        <button className="w-full flex items-center justify-center gap-1 bg-cyan-950/40 border border-cyan-800/40 text-cyan-400 font-bold py-2 rounded-xl text-xs cursor-default">
                          <Check className="w-4.5 h-4.5" /> Equipped Style
                        </button>
                      ) : (
                        <button
                          onClick={() => handleEquipSkin(skin.id)}
                          className="w-full bg-slate-800/80 hover:bg-slate-700 text-white font-bold py-2 rounded-xl text-xs transition border border-slate-700 cursor-pointer"
                        >
                          Equip Theme
                        </button>
                      )
                    ) : (
                      <button
                        onClick={() => handlePurchaseSkin(skin)}
                        className={`w-full flex items-center justify-center gap-1.5 font-bold py-2 rounded-xl text-xs transition cursor-pointer ${
                          stats.coins >= skin.cost
                            ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-md font-black'
                            : 'bg-slate-800/50 border border-slate-850 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        <Coins className="w-4 h-4" />
                        <span>Unlock for {skin.cost} Coins</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB CONTENT: ACHIEVEMENTS */}
      {activeTab === 'achievements' && (
        <div>
          <h3 className="text-sm font-black text-amber-400 mb-4 tracking-[0.2em] uppercase font-bold">Achievements Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ACHIEVEMENTS.map((ach) => {
              const isUnlocked = stats.unlockedAchievements.includes(ach.id);

              return (
                <div
                  key={ach.id}
                  className={`border p-5 rounded-3xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition backdrop-blur-sm ${
                    isUnlocked
                      ? 'bg-emerald-950/20 border-emerald-500/20'
                      : 'bg-slate-900/40 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-3 rounded-2xl border shrink-0 ${
                        isUnlocked
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-md shadow-emerald-500/5'
                          : 'bg-slate-950 border-slate-850 text-slate-600'
                      }`}
                    >
                      <Trophy className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className={`font-bold text-sm ${isUnlocked ? 'text-white font-black' : 'text-slate-400'}`}>
                        {ach.title}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">{ach.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                    <span className="flex items-center gap-1 text-xs font-black text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2.5 py-1 rounded-lg">
                      +{ach.rewardCoins} <Coins className="w-3.5 h-3.5" />
                    </span>
                    {isUnlocked ? (
                      <span className="flex items-center justify-center bg-gradient-to-tr from-emerald-500 to-green-500 text-slate-950 h-7 w-7 rounded-full text-xs font-extrabold shadow-sm">
                        ✓
                      </span>
                    ) : (
                      <span className="flex items-center justify-center bg-slate-800 border border-slate-700 text-slate-500 h-7 w-7 rounded-full text-[10px] font-black font-bold">
                        🔒
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
