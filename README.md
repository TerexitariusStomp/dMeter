# dMeter

A modern environmental analysis platform built with React and FastAPI.

## Features

- Real-time environmental data monitoring
- Interactive data visualization
- User-friendly interface
- RESTful API backend
- TypeScript for type safety
- Material-UI components for modern design

## Getting Started

### Prerequisites

- Node.js >= 18.16.0
- Python >= 3.10
- npm or yarn

### Installation

1. Clone the repository:
\\\ash
git clone https://github.com/TerexitariusStomp/dmeter.git
cd dmeter
\\\`n
2. Install frontend dependencies:
\\\ash
cd frontend
npm install
\\\`n
3. Install backend dependencies:
\\\ash
cd ../backend
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate
pip install -r requirements.txt
\\\`n
### Development

1. Start the frontend development server:
\\\ash
cd frontend
npm start
\\\`n
2. Start the backend development server:
\\\ash
cd backend
uvicorn app.main:app --reload
\\\`n
The frontend will be available at http://localhost:3000 and the backend API at http://localhost:8000.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
