<?php
if (!defined('_PS_VERSION_')) {
    exit;
}

class Recacor_PeriodocancelCronModuleFrontController extends ModuleFrontController
{
    const STATUS_CANCELACION = 20;
    const STATUS_PREPARACION = 3;

    public function __construct()
    {
        parent::__construct();
        // Evitar que PS intente renderizar layout HTML completo
        $this->ajax = true;
    }

    public function initContent()
    {
        header('Content-Type: text/plain');

        // Validar token de seguridad
        if (Tools::getValue('token') !== Tools::encrypt('recacor_periodocancel/cron')) {
            header('HTTP/1.1 403 Forbidden');
            die('Forbidden');
        }

        try {
            // Buscar pedidos en estado 20 cuya última entrada en ese estado fue hace >10 min
            $orders = Db::getInstance()->executeS('
                SELECT o.id_order
                FROM `' . _DB_PREFIX_ . 'orders` o
                WHERE o.current_state = ' . (int)self::STATUS_CANCELACION . '
                AND (
                    SELECT MAX(oh.date_add)
                    FROM `' . _DB_PREFIX_ . 'order_history` oh
                    WHERE oh.id_order = o.id_order
                    AND oh.id_order_state = ' . (int)self::STATUS_CANCELACION . '
                ) <= DATE_SUB(NOW(), INTERVAL 10 MINUTE)
            ');

            $count = 0;
            foreach ($orders as $row) {
                $order = new Order((int)$row['id_order']);
                $order->setCurrentState(self::STATUS_PREPARACION);
                $count++;
            }

            die('OK -- ' . $count . ' pedidos procesados');
        } catch (Exception $e) {
            PrestaShopLogger::addLog(
                'recacor_periodocancel cron error: ' . $e->getMessage(),
                3,
                null,
                'Order',
                null,
                true
            );
            die('ERROR -- ver logs PS');
        }
    }
}
