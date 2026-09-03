import 'bootstrap/dist/css/bootstrap.min.css';

const RequestPath = ({ request }) => {
  return (
    <div className="panel-heading">
      <h4 className="panel-title">
        {request.path}
      </h4>
    </div>
  )
};

export default RequestPath;