import 'bootstrap/dist/css/bootstrap.min.css';
import { Link } from "react-router-dom";

const NavBar = () => {
  return (
    <nav className="app-navbar">
      <div className="nav-inner">
        <Link to="/" className="brand">
          <span className="brand-dot" />
          T5 Request Bin
        </Link>
      </div>
    </nav>
  );
};

export default NavBar;
