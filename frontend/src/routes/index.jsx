import { createBrowserRouter } from 'react-router-dom';
import Landing          from '../pages/Landing';
import Login            from '../pages/Login';
import Dashboard        from '../pages/Dashboard';
import CreateChallenge  from '../pages/CreateChallenge';
import ChallengeDetail  from '../pages/ChallengeDetail';
import Gameplay         from '../pages/Gameplay';
import Results          from '../pages/Results';
import Explore          from '../pages/Explore';

export const router = createBrowserRouter([
  { path: '/',              element: <Landing /> },
  { path: '/login',         element: <Login /> },
  { path: '/dashboard',     element: <Dashboard /> },
  { path: '/create',        element: <CreateChallenge /> },
  { path: '/challenge/:id', element: <ChallengeDetail /> },
  { path: '/play/:id/:songIndex', element: <Gameplay /> },
  { path: '/results/:id',   element: <Results /> },
  { path: '/explore',       element: <Explore /> },
]);
