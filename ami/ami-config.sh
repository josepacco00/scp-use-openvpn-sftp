sudo apt update -y

cd /home/ssm-user/

sudo wget https://dev.mysql.com/get/mysql80-community-release-el9-1.noarch.rpm
sudo dnf install mysql80-community-release-el9-1.noarch.rpm -y
sudo rpm --import https://repo.mysql.com/RPM-GPG-KEY-mysql-2023

sudo dnf install -y mysql-community-server
sudo dnf install -y php8.3 php8.3-cli php8.3-fpm php8.3-mysqlnd php8.3-gmp php8.3-intl php8.3-mbstring php8.3-gd php8.3-zip php8.3-xml php8.3-opcache php8.3-soap
sudo dnf install -y nginx

sudo systemctl start nginx php-fpm
sudo systemctl enable nginx php-fpm

sudo yum install -y amazon-efs-utils
sudo timedatectl set-timezone America/Lima
