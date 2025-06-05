import React, {useState} from 'react';
import LandingPage from './screens/LandingPage';

export default function App() {
    const [email, setEmail] = useState(null);

    return <LandingPage email={email} setEmail={setEmail}/>;
}
