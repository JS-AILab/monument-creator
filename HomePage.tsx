import React, { useState, useCallback } from 'react';
import App from './App'; // The existing App component will be refactored into the Create Monument Page
import MapPage from './MapPage'; // The new MapPage component

type AppView = 'map' | 'create';

const HomePage: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>('map');

  // Callback to navigate to the Map Page
  const handleNavigateToMap = useCallback(() => {
    setCurrentView('map');
  }, []);

  // Callback to navigate to the Create Monument Page
  const handleNavigateToCreate = useCallback(() => {
    setCurrentView('create');
  }, []);

  return (
    <div className="w-full h-screen">
      {currentView === 'map' ? (
        <MapPage onNavigateToCreate={handleNavigateToCreate} />
      ) : (
        <App onNavigateToMap={handleNavigateToMap} />
      )}
    </div>
  );
};

export default HomePage;