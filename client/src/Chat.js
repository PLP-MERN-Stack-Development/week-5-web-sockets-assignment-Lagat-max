import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from './socket/socket';

const Chat = () => {
  const [username, setUsername] = useState('');
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [joined, setJoined] = useState(false);
  const [privateRecipient, setPrivateRecipient] = useState('');
  const [privateInput, setPrivateInput] = useState('');
  const [showPrivate, setShowPrivate] = useState(false);
  const [reactions, setReactions] = useState({});
  const inputRef = useRef(null);
  const {
    isConnected,
    messages,
    users,
    typingUsers,
    connect,
    disconnect,
    sendMessage,
    setTyping,
    sendPrivateMessage,
  } = useSocket();

  useEffect(() => {
    if (isTyping) {
      setTyping(true);
      const timeout = setTimeout(() => setTyping(false), 1000);
      return () => {
        setTyping(false);
        clearTimeout(timeout);
      };
    } else {
      setTyping(false);
    }
  }, [input]);

  useEffect(() => {
    setTyping(isTyping);
  }, [isTyping, setTyping]);

  useEffect(() => {
    // Listen for reaction updates from the server
    if (!socket) return;
    const onReactionUpdate = (data) => {
      setReactions((prev) => ({ ...prev, [data.messageId]: data.reactions }));
    };
    socket.on('reaction_update', onReactionUpdate);
    return () => {
      socket.off('reaction_update', onReactionUpdate);
    };
  }, []);

  useEffect(() => {
    if (joined && 'Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  }, [joined]);

  useEffect(() => {
    if (!joined) return;
    const handleNotify = (msg) => {
      if (document.hasFocus()) return;
      if (msg.system) return;
      if (msg.isPrivate && msg.sender !== username) {
        new window.Notification(`[Private] ${msg.sender}`, { body: msg.message });
      } else if (!msg.isPrivate) {
        new window.Notification(`${msg.sender}`, { body: msg.message });
      }
    };
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      handleNotify(lastMsg);
    }
  }, [messages, joined, username]);

  const handleReact = (messageId, reaction) => {
    socket.emit('add_reaction', { messageId, reaction });
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (username.trim()) {
      connect(username);
      setJoined(true);
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage(input);
      setInput('');
      inputRef.current?.focus();
    }
  };

  const handleSendPrivate = (e) => {
    e.preventDefault();
    if (privateRecipient && privateInput.trim()) {
      sendPrivateMessage(privateRecipient, privateInput);
      setPrivateInput('');
    }
  };

  return (
    <div style={{ maxWidth: 500, margin: '0 auto', padding: 16 }}>
      {!joined ? (
        <form onSubmit={handleJoin} style={{ marginBottom: 16 }}>
          <input
            type="text"
            placeholder="Enter your username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            style={{ width: '70%', marginRight: 8 }}
          />
          <button type="submit">Join</button>
        </form>
      ) : (
        <>
          <div style={{ marginBottom: 8 }}>
            <strong>Status:</strong> {isConnected ? 'Online' : 'Offline'}
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Online users:</strong> {users.map(u => u.username).join(', ')}
          </div>
          <div style={{ marginBottom: 8 }}>
            <button type="button" onClick={() => setShowPrivate((v) => !v)}>
              {showPrivate ? 'Hide' : 'Show'} Private Message
            </button>
          </div>
          {showPrivate && (
            <form onSubmit={handleSendPrivate} style={{ marginBottom: 8, display: 'flex', alignItems: 'center' }}>
              <select
                value={privateRecipient}
                onChange={e => setPrivateRecipient(e.target.value)}
                style={{ marginRight: 8 }}
                required
              >
                <option value="" disabled>Select user</option>
                {users.filter(u => u.username !== username).map(u => (
                  <option key={u.id} value={u.id}>{u.username}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Type a private message..."
                value={privateInput}
                onChange={e => setPrivateInput(e.target.value)}
                style={{ flex: 1, marginRight: 8 }}
                disabled={!isConnected}
              />
              <button type="submit" disabled={!isConnected || !privateRecipient || !privateInput.trim()}>Send</button>
            </form>
          )}
          <div style={{ height: 250, overflowY: 'auto', border: '1px solid #ccc', marginBottom: 8, padding: 8 }}>
            {messages.map(msg => (
              <div key={msg.id} style={{ color: msg.system ? '#888' : msg.isPrivate ? '#007bff' : '#000', fontStyle: msg.isPrivate ? 'italic' : 'normal', marginBottom: 4 }}>
                {msg.system ? (
                  <em>{msg.message}</em>
                ) : msg.isPrivate ? (
                  <>
                    <strong>[Private] {msg.sender}:</strong> {msg.message}
                    <span style={{ fontSize: 10, color: '#888', marginLeft: 8 }}>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                  </>
                ) : (
                  <>
                    <strong>{msg.sender}:</strong> {msg.message}
                    <span style={{ fontSize: 10, color: '#888', marginLeft: 8 }}>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                  </>
                )}
                {/* Reactions UI */}
                {!msg.system && (
                  <div style={{ marginTop: 2 }}>
                    {['👍', '❤️', '😂', '😮', '🎉'].map(r => (
                      <button key={r} style={{ marginRight: 2, fontSize: 14 }} onClick={() => handleReact(msg.id, r)} type="button">{r}</button>
                    ))}
                    <span style={{ marginLeft: 8, fontSize: 12 }}>
                      {reactions[msg.id] && Object.entries(reactions[msg.id]).map(([r, count]) => (
                        <span key={r} style={{ marginRight: 4 }}>{r} {count}</span>
                      ))}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 8, minHeight: 20 }}>
            {typingUsers.length > 0 && (
              <em>{typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...</em>
            )}
          </div>
          <form onSubmit={handleSend} style={{ display: 'flex' }}>
            <input
              ref={inputRef}
              type="text"
              placeholder="Type a message..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onFocus={() => setIsTyping(true)}
              onBlur={() => setIsTyping(false)}
              style={{ flex: 1, marginRight: 8 }}
              disabled={!isConnected}
            />
            <button type="submit" disabled={!isConnected || !input.trim()}>Send</button>
            <button type="button" onClick={disconnect} style={{ marginLeft: 8 }}>Leave</button>
          </form>
        </>
      )}
    </div>
  );
};

export default Chat; 