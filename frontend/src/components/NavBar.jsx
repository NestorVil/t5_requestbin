import 'bootstrap/dist/css/bootstrap.min.css';

const NavBar = () => {
  return (
    <>
      <nav className="navbar">
        <div className="container">
          <div>
            <a href="#" className="navbar-brand">T5 Request Bin</a>
          </div>

          <div className="ms-auto">
            <p className="mb-0">Insert form buttons here</p>
          </div>
        </div>
      </nav>
    </>
  );
};

export default NavBar;