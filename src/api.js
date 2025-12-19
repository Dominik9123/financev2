export const registerUser = async (username, email, password) => {
    const res = await fetch("http://localhost:5109/api/auth/register", {
        method: "POST",
        headers: {
            "Content-Type": "application/json" },
            body: JSON.stringify({ username, email, password }),
    });
    return res.json();
};

export const loginUser = async (username, password) => {
    const res =  await fetch("http://localhost:5109/api/auth/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
    });
    return res.json();
}