import Toolbar from './components/Toolbar';
import ToolPalette from './components/ToolPalette';
import NetworkCanvas from './components/NetworkCanvas';
import PropertiesPanel from './components/PropertiesPanel';
import ResultsPanel from './components/ResultsPanel';
import MapLegend from './components/MapLegend';
import TimeBar from './components/TimeBar';
import StatusBar from './components/StatusBar';
import ProfileChart from './components/ProfileChart';
import './App.css';

export default function App() {
  return (
    <div className="app">
      <Toolbar />
      <div className="app-body">
        <ToolPalette />
        <div className="canvas-area">
          <div className="map-viewport">
            <NetworkCanvas />
            <MapLegend />
            <TimeBar />
          </div>
          <ProfileChart />
        </div>
        <aside className="sidebar">
          <PropertiesPanel />
          <div className="sidebar-divider" />
          <ResultsPanel />
        </aside>
      </div>
      <StatusBar />
    </div>
  );
}
