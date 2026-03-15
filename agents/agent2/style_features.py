import socket



def start_server():

    # 1. Create a TCP/IP socket

    server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)



    # 2. Bind the socket to a specific IP and port

    host = '127.0.0.1'  # Localhost

    port = 65432        # Use a port number > 1023

    server_socket.bind((host, port))



    # 3. Listen for incoming connections

    server_socket.listen()

    print(f"Server is listening on {host}:{port}...")



    # 4. Accept a client connection (this blocks until a client connects)

    conn, addr = server_socket.accept()

    

    with conn:

        print(f"Client connected from: {addr}")

        while True:

            # 5. Receive data from the client (buffer size 1024 bytes)

            data = conn.recv(1024)

            

            # If no data is received, the client closed the connection

            if not data:

                print("Client disconnected.")

                break

                

            print(f"Received from client: {data.decode('utf-8')}")

            

            # 6. Send a response back to the client

            response = "Message received loud and clear!"

            conn.sendall(response.encode('utf-8'))



if __name__ == "__main__":

    start_server()
