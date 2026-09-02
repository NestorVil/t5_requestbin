import 'bootstrap/dist/css/bootstrap.min.css';
import { Link } from "react-router-dom";

const NavBar = () => {
  return (
    <nav className="navbar">
      <div className="container">
        <Link to="/" className="navbar-brand text-primary">
          T5 Request Bin
        </Link>
      </div>
    </nav>

  );
};

export default NavBar;