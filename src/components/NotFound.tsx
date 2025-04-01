import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/useTheme';
import Header from './Header';
import Footer from './Footer';
import { useState, useEffect, useRef } from 'react';

// Define interface for extended style properties
interface ExtendedBeeStyle extends React.CSSProperties {
  originalLeft: number;
  originalTop: number;
}

// Bee component for animation
const Bee = ({ style }: { style: React.CSSProperties }) => {
  return (
    <div style={style}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12,8 C8,8 8,16 12,16 C16,16 16,8 12,8 Z" fill="#FFC107" stroke="none" />
        <path d="M6,12 L3,12" strokeLinecap="round" />
        <path d="M18,12 L21,12" strokeLinecap="round" />
        <circle cx="9" cy="10" r="1" fill="black" stroke="none" />
        <circle cx="15" cy="10" r="1" fill="black" stroke="none" />
        <path d="M12,4 L12,2" strokeLinecap="round" />
        <path d="M12,13 C11.5,13.5 12.5,13.5 12,13" strokeLinecap="round" />
      </svg>
    </div>
  );
};

// Define interface for bee objects
interface BeeObject {
  id: number;
  style: ExtendedBeeStyle;
}

const NotFound = () => {
  const { isDarkMode } = useTheme();
  const [showTables, setShowTables] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [bees, setBees] = useState<BeeObject[]>([]);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const lastUpdateTime = useRef<number>(Date.now());
  const updateRate = 50; // Only update every 50ms to prevent performance issues

  // Handle mouse movement
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const now = Date.now();
      if (now - lastUpdateTime.current < updateRate) {
        return;
      }
      lastUpdateTime.current = now;

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setMousePosition({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top
        });
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
    }

    return () => {
      if (container) {
        container.removeEventListener('mousemove', handleMouseMove);
      }
    };
  }, []);

  // Generate random bees on component mount and react to mouse movement
  useEffect(() => {
    const beeCount = 95; // Increased bee count
    const newBees: BeeObject[] = [];

    for (let i = 0; i < beeCount; i++) {
      const originalLeft = Math.random() * 90;
      const originalTop = Math.random() * 90;

      const style: ExtendedBeeStyle = {
        position: 'absolute',
        left: `${originalLeft}%`,
        top: `${originalTop}%`,
        transform: `scale(${0.7 + Math.random() * 0.6})`,
        color: isDarkMode ? '#F7BF01' : '#F5AB00',
        opacity: 0.7 + Math.random() * 0.3,
        // Store base position for movement calculations
        originalLeft,
        originalTop,
        // Remove animation as it conflicts with our mouse movement
        zIndex: 1,
        pointerEvents: 'none',
        transition: 'left 0.3s ease-out, top 0.3s ease-out',
      };

      newBees.push({
        id: i,
        style
      });
    }

    setBees(newBees);

    return () => {
      // Cleanup only
    };
  }, [isDarkMode]);

  // Update bee positions based on mouse movement
  useEffect(() => {
    if (mousePosition.x === 0 && mousePosition.y === 0) return;

    const updateBees = () => {
      if (!containerRef.current) return;

      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;

      setBees(prevBees =>
        prevBees.map(bee => {
          // Extract position from CSS percentages
          const beeStyle = bee.style;
          const beeLeft = parseFloat(beeStyle.left as string) / 100 * containerWidth;
          const beeTop = parseFloat(beeStyle.top as string) / 100 * containerHeight;

          // Calculate distance from mouse
          const dx = mousePosition.x - beeLeft;
          const dy = mousePosition.y - beeTop;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // If mouse is close enough, bees will react
          if (distance < 200) {
            // Calculate the intensity of the reaction based on distance
            const intensity = Math.max(0, 1 - distance / 200);

            // The closer the mouse, the stronger the bee flees
            const fleeX = -dx * intensity * 2;
            const fleeY = -dy * intensity * 2;

            // Calculate new position as percentage of container
            const newLeft = ((beeLeft + fleeX) / containerWidth) * 100;
            const newTop = ((beeTop + fleeY) / containerHeight) * 100;

            // Ensure bees stay within bounds (with some margin)
            const boundedLeft = Math.max(5, Math.min(95, newLeft));
            const boundedTop = Math.max(5, Math.min(95, newTop));

            return {
              ...bee,
              style: {
                ...beeStyle,
                left: `${boundedLeft}%`,
                top: `${boundedTop}%`,
              }
            };
          }

          // If mouse is far away, gradually return to original position
          const originalLeft = beeStyle.originalLeft;
          const originalTop = beeStyle.originalTop;
          const currentLeft = parseFloat(beeStyle.left as string);
          const currentTop = parseFloat(beeStyle.top as string);

          // Move 5% closer to original position
          const returnLeft = currentLeft + (originalLeft - currentLeft) * 0.05;
          const returnTop = currentTop + (originalTop - currentTop) * 0.05;

          return {
            ...bee,
            style: {
              ...beeStyle,
              left: `${returnLeft}%`,
              top: `${returnTop}%`,
            }
          };
        })
      );
    };

    // Only update at a controlled rate to prevent excessive renders
    const timerId = setTimeout(updateBees, 30);
    return () => clearTimeout(timerId);
  }, [mousePosition]);

  // Add individual bee movement for more natural behavior
  useEffect(() => {
    const beeMovementInterval = setInterval(() => {
      setBees(prevBees =>
        prevBees.map(bee => {
          const beeStyle = bee.style;

          // Add a small random movement to each bee (1% in any direction)
          const jitter = 0.5;
          const randomX = (Math.random() - 0.5) * jitter;
          const randomY = (Math.random() - 0.5) * jitter;

          const currentLeft = parseFloat(beeStyle.left as string);
          const currentTop = parseFloat(beeStyle.top as string);

          return {
            ...bee,
            style: {
              ...beeStyle,
              left: `${Math.max(0, Math.min(100, currentLeft + randomX))}%`,
              top: `${Math.max(0, Math.min(100, currentTop + randomY))}%`,
            }
          };
        })
      );
    }, 60); // Update every 60ms for subtle movement

    return () => {
      clearInterval(beeMovementInterval);
    };
  }, []);

  // Main container style
  const containerStyle: React.CSSProperties = {
    backgroundColor: isDarkMode ? '#0f172a' : '#0f172a', // Dark blue or light background
    color: isDarkMode ? '#f8fafc' : '#1e293b', // Light or dark text
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden'
  };

  // Content style
  const contentStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    textAlign: 'center',
    position: 'relative',
    zIndex: 2
  };

  // Card style
  const cardStyle: React.CSSProperties = {
    backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
    borderRadius: '0.75rem',
    border: `1px solid ${isDarkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(226, 232, 240, 1)'}`,
    padding: '2.5rem',
    maxWidth: '32rem',
    width: '100%',
    boxShadow: isDarkMode ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    marginTop: '1rem',
    position: 'relative',
    overflow: 'hidden'
  };

  // Button style
  const buttonStyle: React.CSSProperties = {
    backgroundColor: isHovered ? '#F5AB00' : '#F7BF01', // Bee yellow color
    color: '#000000', // Black text
    padding: '0.75rem 1.5rem',
    borderRadius: '0.375rem',
    fontWeight: '500',
    textDecoration: 'none',
    display: 'inline-block',
    marginTop: '1.5rem',
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  };

  return (
    <div style={containerStyle} ref={containerRef}>
      <Header showTables={showTables} setShowTables={setShowTables} />

      {/* Flying bees in the background */}
      {bees.map((bee) => (
        <div id={`bee-${bee.id}`} key={bee.id} style={{
          position: 'absolute',
          left: bee.style.left,
          top: bee.style.top,
          transition: 'left 0.2s ease-out, top 0.2s ease-out',
          zIndex: 1
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke={bee.style.color} strokeWidth="2">
            <path d="M12,8 C8,8 8,16 12,16 C16,16 16,8 12,8 Z" fill="#FFC107" stroke="none" />
            <path d="M6,12 L3,12" strokeLinecap="round" />
            <path d="M18,12 L21,12" strokeLinecap="round" />
            <circle cx="9" cy="10" r="1" fill="black" stroke="none" />
            <circle cx="15" cy="10" r="1" fill="black" stroke="none" />
            <path d="M12,4 L12,2" strokeLinecap="round" />
            <path d="M12,13 C11.5,13.5 12.5,13.5 12,13" strokeLinecap="round" />
          </svg>
        </div>
      ))}

      <div style={contentStyle}>
        <div style={cardStyle}>
          <div style={{ marginBottom: '1.5rem', position: 'relative' }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke={isDarkMode ? '#f87171' : '#ef4444'} style={{ width: '5rem', height: '5rem', margin: '0 auto', opacity: 0.8 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div style={{ position: 'absolute', top: '20%', left: '60%', transform: 'rotate(15deg)' }}>
              <Bee style={{ width: '40px', height: '40px', color: '#F7BF01' }} />
            </div>
          </div>

          <h1 style={{ fontSize: '1.875rem', fontWeight: '700', marginBottom: '1rem', color: isDarkMode ? '#f8fafc' : '#1e293b' }}>
            404 - Page Not Found
          </h1>

          <p style={{ fontSize: '1.125rem', color: isDarkMode ? '#cbd5e1' : '#475569', marginBottom: '0.5rem' }}>
            Oh <strong>hive</strong>! We couldn't find the page you were looking for.
          </p>

          <p style={{ fontSize: '1rem', color: isDarkMode ? '#a3b5d0' : '#64748b', marginBottom: '1.5rem', fontStyle: 'italic' }}>
            Looks like this page flew away and is <strong>bee-yond</strong> our reach!
          </p>


          <Link
            to="/"
            style={buttonStyle}
            onMouseOver={() => setIsHovered(true)}
            onMouseOut={() => setIsHovered(false)}
          >
            Buzz Back Home
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default NotFound;
