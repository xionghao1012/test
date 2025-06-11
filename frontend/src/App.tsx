import { useState, useRef, useEffect, useCallback } from 'react';
import api, { createRoom, joinRoom } from './services/api';
import './App.css';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);
  const [isEraser, setIsEraser] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [roundActive, setRoundActive] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [roundsPlayed, setRoundsPlayed] = useState(0);
  const [maxRounds, setMaxRounds] = useState(5);
  const [currentWord, setCurrentWord] = useState('');
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [players, setPlayers] = useState<string[]>([]);
  const [isInRoom, setIsInRoom] = useState(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isDrawingTurn, setIsDrawingTurn] = useState(false);
  const [aiGuess, setAiGuess] = useState('');
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
 
  // WebSocket连接函数
  const connectWebSocket = useCallback(() => {
    if (socket) socket.close();
    const newSocket = new WebSocket(`ws://localhost:3001?roomId=${roomId}&playerName=${playerName}`);
    setSocket(newSocket);

    newSocket.onopen = () => {
      console.log('WebSocket连接已建立');
    };

    newSocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleSocketMessage(message);
      } catch (error) {
        console.error('解析WebSocket消息失败:', error);
      }
    };

    newSocket.onclose = () => {
      console.log('WebSocket连接已关闭');
      if (!gameOver) {
        setTimeout(connectWebSocket, 3000);
      }
    };

    newSocket.onerror = (error) => {
      console.error('WebSocket错误:', error);
    };
    
    return newSocket;
  }, [roomId, playerName, gameOver]);

  // 处理WebSocket消息
  interface SocketMessage {
    type: string;
    players?: string[];
    playerName?: string;
    data?: DrawData;
    guess?: string;
    word?: string;
    roundsPlayed?: number;
    maxRounds?: number;
    gameOver?: boolean;
    drawer?: string;
  }

  interface DrawData {
    type: 'start' | 'draw';
    x: number;
    y: number;
    lastX?: number;
    lastY?: number;
    color: string;
    size: number;
  }
  const startNewRound = useCallback(() => {
    if (socket) {
      socket.send(JSON.stringify({
        type: 'start_round',
        roomId: roomId
      }));
    }
  }, [socket, roomId]);
  const handleSocketMessage = (message: SocketMessage) => {
    switch (message.type) {
      case 'player_joined':
        setPlayers(message.players || []);
        break;
      case 'player_left':
        setPlayers(message.players || []);
        break;
      case 'draw_action':
        if (message.playerName !== playerName && message.data) {
          drawFromData(message.data);
        }
        break;
      case 'ai_guess':
        setAiGuess(message.guess || '');
        if (message.guess?.toLowerCase().includes(currentWord.toLowerCase())) {
          setScore(prev => prev + 100);
          alert(`AI猜对了! +100分\nAI猜测: ${message.guess}\n正确答案: ${currentWord}`);
          endRound();
        }
        break;
      case 'round_started':
        setRoundActive(true);
        setCurrentWord(message.word || '');
        setTimeLeft(60);
        setIsDrawingTurn(message.drawer === playerName);
        clearCanvas();
        setAiGuess('');
        break;
      case 'round_ended':
        setRoundActive(false);
        setCurrentWord('');
        setRoundsPlayed(message.roundsPlayed ?? roundsPlayed);
        setMaxRounds(message.maxRounds ?? maxRounds);
        if (message.gameOver) {
          setGameOver(true);
        }
        break;
      default:
        console.log('未知消息类型:', message.type);
    }
  };

  // 从数据绘制
  const drawFromData = (data: DrawData) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = data.color;
    ctx.lineWidth = data.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (data.type === 'start') {
      ctx.beginPath();
      ctx.moveTo(data.x, data.y);
    } else if (data.type === 'draw') {
      ctx.beginPath();
      ctx.moveTo(data.lastX ?? 0, data.lastY ?? 0);
      ctx.lineTo(data.x, data.y);
      ctx.stroke();
    }
  };

  // 更新得分
  const incrementScore = useCallback((points: number) => {
    setScore(prev => prev + points);
  }, []);

  // 结束回合
  const endRound = useCallback(() => {
    setRoundActive(false);
    setRoundsPlayed(prev => prev + 1);
    incrementScore(10);

    if (roundsPlayed + 1 >= maxRounds) {
      setGameOver(true);
    } else {
      setTimeout(startNewRound, 3000);
    }
  }, [incrementScore, roundsPlayed, maxRounds, startNewRound]);



  // 清除画布
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  // 保存画布
  const saveCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataURL = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `drawing-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = dataURL;
    link.click();
  }, []);

  // AI猜图功能
  const handleAIGuess = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !roomId) return;

    try {
      const imageData = canvas.toDataURL('image/png');
      setAiGuess('AI正在识别...');

      const response = await api.post('/recognize', {
        imageData,
        roomId
      });

      setAiGuess(response.data.guess);
    } catch (error) {
      console.error('AI识别失败:', error);
      setAiGuess('识别失败，请重试');
    }
  };

  // 重新开始游戏
  const handleRestartGame = useCallback(() => {
    setGameOver(false);
    setScore(0);
    setRoundsPlayed(0);
    clearCanvas();
    if (socket) {
      socket.send(JSON.stringify({
        type: 'start_round',
        roomId
      }));
    }
  }, [clearCanvas, socket, roomId]);

  // Canvas initialization and drawing logic
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set default styles
    ctx.strokeStyle = isEraser ? '#ffffff' : brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Drawing functions
    const startDrawing = (e: MouseEvent) => {
      if (!isDrawingTurn || !roundActive) return;
      setIsDrawing(true);
      ctx.beginPath();
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      ctx.moveTo(x, y);
      lastPosRef.current = { x, y };
      
      if (socket) {
        socket.send(JSON.stringify({
          type: 'draw_action',
          roomId,
          playerName,
          data: {
            type: 'start',
            x,
            y,
            color: isEraser ? '#ffffff' : brushColor,
            size: brushSize
          }
        }));
      }
    };

    const draw = (e: MouseEvent) => {
      if (!isDrawing || !isDrawingTurn || !roundActive || !ctx) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      ctx.lineTo(x, y);
      ctx.stroke();
      
      if (socket && lastPosRef.current) {
        socket.send(JSON.stringify({
          type: 'draw_action',
          roomId,
          playerName,
          data: {
            type: 'draw',
            x,
            y,
            lastX: lastPosRef.current.x,
            lastY: lastPosRef.current.y,
            color: isEraser ? '#ffffff' : brushColor,
            size: brushSize
          }
        }));
      }
      
      lastPosRef.current = { x, y };
    };

    const stopDrawing = () => {
      setIsDrawing(false);
      if (ctx) ctx.closePath();
      lastPosRef.current = null;
    };

    // Event listeners
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    // Cleanup
    return () => {
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('mouseout', stopDrawing);
    };
  }, [isDrawing, brushColor, brushSize, isDrawingTurn, roundActive, socket, playerName, roomId, isEraser]);

  // 房间处理函数
  const handleCreateRoom = async () => {
    if (!playerName.trim()) {
      alert('请输入昵称');
      return;
    }
    try {
      const data = await createRoom(playerName);
      setRoomId(data.roomId);
      setIsInRoom(true);
      setPlayers([playerName]);
      connectWebSocket();
    } catch (error) {
      alert(error + '创建房间失败，请重试');
    }
  };

  const handleJoinRoom = async () => {
    if (!playerName.trim() || !roomId.trim()) {
      alert('请输入昵称和房间ID');
      return;
    }
    try {
      const data = await joinRoom(roomId, playerName);
      setIsInRoom(true);
      setPlayers(data.players);
      connectWebSocket();
    } catch (error) {
      alert(`加入房间失败: ${error instanceof Error ? error.message : error}`);
    }
  };

 

  // 计时器逻辑
  useEffect(() => {
    if (roundActive && timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0) {
      endRound();
    }
  }, [roundActive, endRound]);
  

  // 关闭WebSocket连接
  useEffect(() => {
    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [socket]);

  return (
    <div className="App">
      <header className="app-header">
        <h1>AI 你画我猜</h1>
        {isInRoom ? (
          <div className="game-info">
            {gameOver && (
              <div className="game-over">
                <h2>游戏结束!</h2>
                <p>总回合: {roundsPlayed}/{maxRounds}</p>
                <p>最终得分: {score}</p>
                <button className="btn restart-btn" onClick={handleRestartGame}>再来一局</button>
              </div>
            )}
            <div>房间 ID: {roomId}</div>
            <div className="score">得分: {score}</div>
            <div className="timer">时间: {timeLeft}s</div>
            {roundActive && (
              <div className="word-hint">
                <span>当前词汇: </span>
                <span className="hint-word">{currentWord}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="room-controls">
            <input
              type="text"
              placeholder="输入昵称"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="name-input"
            />
            <div className="room-buttons">
              <button className="btn create-room-btn" onClick={handleCreateRoom}>创建房间</button>
              <div className="join-room">
                <input
                  type="text"
                  placeholder="房间 ID"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className="room-input"
                />
                <button className="btn join-room-btn" onClick={handleJoinRoom}>加入房间</button>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="game-area">
        <div className="canvas-container">
          <canvas
            ref={canvasRef}
            className="drawing-canvas"
            width={800}
            height={600}
          />
        </div>

        {roundActive && (
          <div className="controls-panel">
            <div className="color-controls">
              <label>画笔颜色:</label>
              <input
                type="color"
                value={brushColor}
                onChange={(e) => setBrushColor(e.target.value)}
                disabled={!isDrawingTurn}
              />
            </div>

            <div className="brush-controls">
              <label>画笔大小: {brushSize}px</label>
              <input
                type="range"
                min="1"
                max="50"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                disabled={!isDrawingTurn}
              />
            </div>

            <div className="eraser-control">
              <label>
                <input
                  type="checkbox"
                  checked={isEraser}
                  onChange={(e) => setIsEraser(e.target.checked)}
                  disabled={!isDrawingTurn}
                />
                使用橡皮擦
              </label>
            </div>

            <div className="action-buttons">
              <button className="btn clear-btn" onClick={clearCanvas} disabled={!isDrawingTurn}>清空画布</button>
              <button className="btn save-btn" onClick={saveCanvas} disabled={!roundActive}>保存绘图</button>
              {isDrawingTurn && (
                <button className="btn guess-btn" onClick={handleAIGuess}>AI 猜图</button>
              )}
            </div>
          </div>
        )}

        {roundActive && (
          <div className="ai-guess">
            <h3>AI 猜测:</h3>
            <p className="guess-result">{aiGuess || '等待绘画...'}</p>
          </div>
        )}

        {isInRoom && (
          <div className="room-players">
            <h3>房间玩家 ({players.length}):</h3>
            <ul className="players-list">
              {players.map((player, index) => (
                <li key={index} className={`player-item ${player === playerName ? 'current-player' : ''}`}>
                  {player} {player === playerName && '(我)'}
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
