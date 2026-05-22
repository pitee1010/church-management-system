async function postSermon(sermonData) {
    const token = localStorage.getItem('token'); // Your auth token

    await fetch('/api/admin/add-sermon', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` // Sends your auth token
        },
        body: JSON.stringify(sermonData)
    });
}