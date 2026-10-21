import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  withXSRFToken: true,
  xsrfCookieName: "csrftoken",
  xsrfHeaderName: "X-CSRFToken",
});

// Redirect to login on 401
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;
