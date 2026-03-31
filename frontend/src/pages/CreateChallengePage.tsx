import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NavBar } from '../components/NavBar';
import { createChallenge } from '../lib/api';

const inputStyle: React.CSSProperties = {
  background: '#282828',
  color: '#FFFFFF',
  border: '1px solid #535353',
  borderRadius: '4px',
  padding: '12px 16px',
  fontFamily: '"Courier New", monospace',
  fontSize: '14px',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
  transition: 'border-color 0.15s',
};

const labelStyle: React.CSSProperties = {
  fontFamily: '"Courier New", monospace',
  fontWeight: 'bold',
  fontSize: '11px',
  color: '#B3B3B3',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  display: 'block',
  marginBottom: '4px',
};

const counterStyle = (length: number, max: number): React.CSSProperties => ({
  fontFamily: '"Courier New", monospace',
  fontSize: '11px',
  color: length > max * 0.85 ? '#FFFFFF' : '#B3B3B3',
  textAlign: 'right',
  marginTop: '4px',
});

const fieldWrapStyle: React.CSSProperties = {
  marginBottom: '24px',
};

const errorMsgStyle: React.CSSProperties = {
  fontFamily: 'Georgia, serif',
  fontSize: '12px',
  color: '#B3B3B3',
  marginTop: '4px',
};

export const CreateChallengePage: React.FC = () => {
  const navigate = useNavigate();

  const [playlistUrl, setPlaylistUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ url?: string; title?: string }>({});

  const validate = () => {
    const errors: { url?: string; title?: string } = {};
    if (!title.trim()) {
      errors.title = 'Title is required';
    }
    const validUrl =
      playlistUrl.startsWith('https://open.spotify.com/playlist/') ||
      playlistUrl.startsWith('spotify:playlist:');
    if (!validUrl) {
      errors.url = 'Please enter a valid Spotify playlist URL';
    }
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await createChallenge({ playlistUrl, title, description, visibility });
      navigate('/dashboard');
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const focusBorder = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    (e.target as HTMLElement).style.borderColor = '#1DB954';
  };
  const blurBorder = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    (e.target as HTMLElement).style.borderColor = '#535353';
  };

  return (
    <div style={{ minHeight: '100vh', background: '#121212', color: '#FFFFFF' }}>
      <NavBar />

      <div
        style={{
          maxWidth: '640px',
          margin: '0 auto',
          padding: '48px 16px',
        }}
      >
        <h1
          style={{
            fontFamily: '"Courier New", monospace',
            fontWeight: 'bold',
            fontSize: '24px',
            color: '#FFFFFF',
            textTransform: 'uppercase',
            marginBottom: '48px',
          }}
        >
          CREATE A CHALLENGE
        </h1>

        <form onSubmit={handleSubmit} noValidate>
          {/* Spotify playlist URL */}
          <div style={fieldWrapStyle}>
            <label style={labelStyle}>Spotify Playlist URL</label>
            <input
              type="url"
              value={playlistUrl}
              onChange={(e) => setPlaylistUrl(e.target.value)}
              placeholder="https://open.spotify.com/playlist/..."
              style={inputStyle}
              onFocus={focusBorder}
              onBlur={blurBorder}
              disabled={submitting}
            />
            {fieldErrors.url && <p style={errorMsgStyle}>{fieldErrors.url}</p>}
          </div>

          {/* Challenge title */}
          <div style={fieldWrapStyle}>
            <label style={labelStyle}>Challenge Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 100))}
              placeholder="Give your challenge a name"
              style={inputStyle}
              onFocus={focusBorder}
              onBlur={blurBorder}
              disabled={submitting}
            />
            <div style={counterStyle(title.length, 100)}>{title.length}/100</div>
            {fieldErrors.title && <p style={errorMsgStyle}>{fieldErrors.title}</p>}
          </div>

          {/* Description */}
          <div style={fieldWrapStyle}>
            <label style={labelStyle}>Description (Optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 300))}
              placeholder="Describe your challenge..."
              style={{
                ...inputStyle,
                height: '80px',
                resize: 'none',
              }}
              onFocus={focusBorder}
              onBlur={blurBorder}
              disabled={submitting}
            />
            <div style={counterStyle(description.length, 300)}>{description.length}/300</div>
          </div>

          {/* Visibility */}
          <div style={fieldWrapStyle}>
            <label style={labelStyle}>Visibility</label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              style={{
                ...inputStyle,
                cursor: 'pointer',
              }}
              onFocus={focusBorder}
              onBlur={blurBorder}
              disabled={submitting}
            >
              <option value="public">Public</option>
              <option value="private">Private — link only</option>
            </select>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            style={{
              background: submitting ? '#169C46' : '#1DB954',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '500px',
              padding: '14px',
              width: '100%',
              fontFamily: '"Courier New", monospace',
              fontWeight: 'bold',
              fontSize: '15px',
              textTransform: 'uppercase',
              cursor: submitting ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
              letterSpacing: '0.05em',
            }}
            onMouseEnter={(e) => {
              if (!submitting) (e.target as HTMLButtonElement).style.background = '#1ED760';
            }}
            onMouseLeave={(e) => {
              if (!submitting) (e.target as HTMLButtonElement).style.background = '#1DB954';
            }}
          >
            {submitting ? 'CREATING...' : 'CREATE CHALLENGE'}
          </button>

          {apiError && (
            <p
              style={{
                fontFamily: 'Georgia, serif',
                fontSize: '13px',
                color: '#B3B3B3',
                marginTop: '16px',
                textAlign: 'center',
              }}
            >
              {apiError}
            </p>
          )}
        </form>
      </div>
    </div>
  );
};
