import Toolbar from './components/Toolbar';
import ToolPalette from './components/ToolPalette';
import NetworkCanvas from './components/NetworkCanvas';
import PropertiesPanel from './components/PropertiesPanel';
import ResultsPanel from './components/ResultsPanel';
import MapLegend from './components/MapLegend';
import TimeBar from './components/TimeBar';
import StatusBar from './components/StatusBar';
import ProfileChart from './components/ProfileChart';
import DisplaySettingsDialog from './components/DisplaySettingsDialog';
import { useNetworkStore } from './store/networkStore';
import './App.css';

export default function App() {
  const showGrid = useNetworkStore((s) => s.display.showGrid);
  return (
    <div className="app">
      <Toolbar />
      <div className="app-body">
        <ToolPalette />
        <div className="canvas-area">
          <div className={`map-viewport ${showGrid ? '' : 'no-grid'}`}>
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
      <DisplaySettingsDialog />
    </div>
  );
}
