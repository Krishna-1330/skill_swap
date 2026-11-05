import 'dotenv/config';
import app from './app.js';
import { connectDatabase } from './db.js';

const port = process.env.PORT || 5000;

// The local server connects before it starts accepting requests.
connectDatabase()
  .then(() => app.listen(port, '0.0.0.0', () => console.log(`SkillSwap API is listening on port ${port}`)))
  .catch((error) => {
    console.error('Could not connect to MongoDB:', error.message);
    process.exit(1);
  });
