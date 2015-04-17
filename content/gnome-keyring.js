Components.utils.import("resource://gre/modules/ctypes.jsm");

var EXPORTED_SYMBOLS = [ "Values",
    "itemDelete",  "itemCreate", "getItems",
"changePassword", "lock", "unlock", "isLocked", "destroy", "create",
"printItem" ];

var SECRET_COLLECTION_DEFAULT=String("default");
var SECRET_COLLECTION_SESSION=String("session");


var Values = {
/*    Result: {
        OK: 0,
        DENIED: 1,
        NO_KEYRING_DAEMON: 2,
        ALREADY_UNLOCKED: 3,
        NO_SUCH_KEYRING: 4,
        BAD_ARGUMENTS: 5,
        IO_ERROR: 6,
        CANCELLED: 7,
        KEYRING_ALREADY_EXISTS: 8,
        NO_MATCH: 9
    },*/
    ItemType: {
        GENERIC_SECRET: 0,
        NETWORK_PASSWORD: 1,
        NOTE: 2,
        CHAINED_KEYRING_PASSWORD: 3,
        ENCRYPTION_KEY_PASSWORD: 4,
        PK_STORAGE: 0x100
    },
    AttributeType: {
        STRING: 0,
        UINT32: 1,
        BOOL: 2
    },
    SecretCollectionFlags: {
        SECRET_COLLECTION_NONE: 0,
        SECRET_COLLECTION_LOAD_ITEMS: 1
    },
    SecretServiceFlags: {
        SECRET_SERVICE_NONE: 0,
        SECRET_SERVICE_OPEN_SESSION: 1,
        SECRET_SERVICE_LOAD_COLLECTIONS: 2,
    }
};

var Type = (function() {
    /* basic types */
    var char = ctypes.char;
    var gchar = ctypes.char;
    var guint32 = ctypes.uint32_t;
    var guint = ctypes.unsigned_int;
    var gboolean = ctypes.bool;
    var gpointer = ctypes.voidptr_t;

    /* enums */
//    var GnomeKeyringResult = ctypes.int;
//    var GnomeKeyringItemType = ctypes.int;
    var SecretSchemaAttributeType = ctypes.int;
    var SecretCollectionCreateFlags = ctypes.int;
    var SecretCollectionFlags = ctypes.int;
    var SecretSearchFlags = ctypes.int;
    var SecretServiceFlags = ctypes.int;

    /* opaque structs */
    var GCancellable = new ctypes.StructType("GCancellable");
    var GError = new ctypes.StructType("GError", [
        {"domain": guint32},
        {"code": guint},
        {"message": gchar.ptr}
    ]);
//    var GnomeKeyringInfo = ctypes.voidptr_t;
//    var GnomeKeyringItemInfo = ctypes.voidptr_t;
    var SecretCollection = ctypes.voidptr_t;
    var SecretService = ctypes.voidptr_t;
    var SecretItem = ctypes.voidptr_t;

    /* structs */
    /**
     * struct GList {
     *   gpointer data;
     *   GList *next;
     *   GList *prev;
     * };
     */
    var GList = new ctypes.StructType("GList", [
        { "data": gpointer },
        { "next": gpointer }, /* we can't reference GList here */
        { "prev": gpointer }  /* same */
    ]);
    /**
     * struct GArray {
     *   gchar *data;
     *   guint len;
     * };
     */
    var GArray = new ctypes.StructType("GList", [
        { "data": gchar.ptr },
        { "len": guint }
    ]);

    var GHashTable = new ctypes.StructType("GHashTable");

    var GHashFunc =  new ctypes.FunctionType(ctypes.default_abi,
        guint, /* return */
        [gpointer /* key */]);

    var GEqualFunc =  new ctypes.FunctionType(ctypes.default_abi,
        gboolean, /* return */
        [gpointer, /* a */ gpointer /* b */]);

//    var GnomeKeyringAttributeList = GHashTable;
    /**
     * struct GnomeKeyringAttribute {
     *   char *name;
     *   GnomeKeyringAttributeType type;
     *   union {
     *     char *string;
     *     guint32 integer;
     *   } value;
     * };
     */
//    var GnomeKeyringAttribute = new ctypes.StructType("GList", [
//        { "name": char.ptr },
//        { "type": GnomeKeyringAttributeType },
        /* we can't have a union, so we choose the biggest type
         * (char *) and cast to guint32 if the type is UINT32 */
//        { "value": char.ptr }
//    ]);

    return {
        char: char,
        gchar: gchar,
        guint32: guint32,
        guint: guint,
        gboolean: gboolean,
        gpointer: gpointer,
//        GnomeKeyringResult: GnomeKeyringResult,
//        GnomeKeyringItemType: GnomeKeyringItemType,
//        GnomeKeyringAttributeType: GnomeKeyringAttributeType,
//        GnomeKeyringInfo: GnomeKeyringInfo,
//        GnomeKeyringItemInfo: GnomeKeyringItemInfo,
        GList: GList,
        GArray: GArray,
        GHashTable: GHashTable,
        GError: GError,
        GCancellable: GCancellable,
//        GnomeKeyringAttribute: GnomeKeyringAttribute,
        SecretService: SecretService,
        SecretCollection: SecretCollection,
        SecretCollectionCreateFlags: SecretCollectionCreateFlags,
        SecretCollectionFlags: SecretCollectionFlags,
        SecretSearchFlags: SecretSearchFlags,
        SecretServiceFlags: SecretServiceFlags,
        SecretItem: SecretItem,
        GHashFunc: GHashFunc,
        GEqualFunc: GEqualFunc
    };
})();

var secretLib = ctypes.open("libsecret-1.so.0");

var glibLib = ctypes.open("libglib-2.0.so.0");

var g_list_append = glibLib.declare("g_list_append",
 ctypes.default_abi,
 Type.GList.ptr, /* return */
 Type.GList.ptr, /* list */
 Type.gpointer /* data */);

var g_list_free = glibLib.declare("g_list_free",
 ctypes.default_abi,
 ctypes.void_t, /* return */
 Type.GList.ptr /* list */);


var g_hash_table_new = glibLib.declare("g_hash_table_new",
    ctypes.default_abi,
    Type.GHashTable.ptr, /* return */
    Type.GHashFunc.ptr, /* hash_func */
    Type.GEqualFunc.ptr /* key_equal_func */);

var g_hash_table_insert = glibLib.declare("g_hash_table_insert",
    ctypes.default_abi,
    ctypes.void_t, /* return */
    Type.GHashTable.ptr, /* hash_table */
    Type.gpointer, /* key */
    Type.gpointer/* value*/);

var g_hash_table_unref = glibLib.declare("g_hash_table_unref",
    ctypes.default_abi,
    ctypes.void_t, /* return */
    Type.GHashTable.ptr /* hash_table */);

var g_str_hash = glibLib.declare("g_str_hash",
    ctypes.default_abi,
    Type.guint, /* return */
    Type.gpointer.ptr /* v */);

var g_str_equal = glibLib.declare("g_str_equal",
    ctypes.default_abi,
    Type.gboolean, /* return */
    Type.gpointer.ptr, /* a */
    Type.gpointer.ptr /* b */);


    /*
SecretService *
secret_service_get_sync (SecretServiceFlags flags,
                         GCancellable *cancellable,
                         GError **error);
                         */

var secret_service_get_sync = secretLib.declare("secret_service_get_sync",
                                               ctypes.default_abi,
                                               Type.SecretService.ptr, /* return */
                                               Type.SecretServiceFlags, /* flags */
                                               Type.GCancellable.ptr, /* cancellable */
                                               Type.GError.ptr.ptr /* error*/);

/**
  SecretCollection *
                        secret_collection_create_sync (SecretService *service,
                                                        const gchar *label,
                                                        const gchar *alias,
                                                        SecretCollectionCreateFlags flags,
                                                        GCancellable *cancellable,
                                                        GError **error);
  */
var secret_collection_create_sync = secretLib.declare("secret_collection_create_sync",
        ctypes.default_abi,
        Type.SecretCollection.ptr, /* return */
        Type.SecretService.ptr, /* service */
        Type.char.ptr, /* label */
        Type.char.ptr, /* alias */
        Type.SecretCollectionCreateFlags, /* flags */
        Type.GCancellable.ptr, /* cancellable */
        Type.GError.ptr.ptr /* error */);

/**
 * gboolean secret_collection_delete_sync (SecretCollection *self,
                               GCancellable *cancellable,
                               GError **error);
 */
        var secret_collection_delete_sync = secretLib.declare("secret_collection_delete_sync",
        ctypes.default_abi,
        Type.gboolean, /* return */
        Type.SecretCollection.ptr, /* self */
        Type.GCancellable.ptr, /* cancellable */
        Type.GError.ptr.ptr /* error */);

/**
 * SecretCollection *
secret_collection_for_alias_sync (SecretService *service,
                                  const gchar *alias,
                                  SecretCollectionFlags flags,
                                  GCancellable *cancellable,
                                  GError **error);
 */
        var secret_collection_for_alias_sync = secretLib.declare("secret_collection_for_alias_sync",
                                                                 ctypes.default_abi,
        Type.SecretCollection.ptr, /* return */
        Type.SecretService.ptr, /* service */
        Type.char.ptr, /* alias */
        Type.SecretCollectionFlags, /* flags */
        Type.GCancellable.ptr, /* cancellable */
        Type.GError.ptr.ptr /* error */);


        /*
        GList *
secret_collection_get_items (SecretCollection *self);

*/

        var secret_collection_get_items = secretLib.declare("secret_collection_get_items",
                                                           ctypes.default_abi,
        Type.GList.ptr, /* return */
        Type.SecretCollection.ptr /* self */);
/**
 * gint secret_service_unlock_sync (SecretService *service,
                                   GList *objects,
                                     GCancellable *cancellable,
                                     GList **unlocked,
                                     GError **error);
 */
        var secret_service_unlock_sync = secretLib.declare("secret_service_unlock_sync",
        ctypes.default_abi,
        ctypes.int, /* return */
        Type.SecretService.ptr, /* service */
        Type.GList.ptr, /* objects */
        Type.GCancellable.ptr, /* cancellable */
        Type.GList.ptr.ptr, /* unlocked */
        Type.GError.ptr.ptr /* error */);

/**
 * gint secret_service_lock_sync (SecretService *service,
                          GList *objects,
                          GCancellable *cancellable,
                          GList **locked,
                          GError **error);
 */
        var secret_service_lock_sync = secretLib.declare("secret_service_lock_sync",
        ctypes.default_abi,
        ctypes.int, /* return */
        Type.GList.ptr, /* objects */
        Type.GCancellable.ptr, /* cancellable */
        Type.GList.ptr.ptr, /* locked */
        Type.GError.ptr.ptr /* error */);

/**
 * GnomeKeyringResult gnome_keyring_change_password_sync (const char *keyring,
 *                                                        const char *original,
 *                                                        const char *password);
 *  need platform specific D-Bus implementation
 */

//        var gnome_keyring_change_password_sync = secretLib.declare("gnome_keyring_change_password_sync",
//                                                                   ctypes.default_abi,
//        Type.GnomeKeyringResult, /* return */
//        Type.char.ptr, /* keyring */
//        Type.char.ptr, /* original */
//        Type.char.ptr /* password */);

/**
 * gboolean secret_service_load_collections_sync (SecretService *self,
                                      GCancellable *cancellable,
                                      GError **error);
 */
        var secret_service_load_connections_sync = secretLib.declare("secret_service_load_collections_sync",
        ctypes.default_abi,
        Type.gboolean, /* return */
        Type.SecretService.ptr, /* self */
        Type.GCancellable.ptr, /* cancellable */
        Type.GError.ptr.ptr /* error */);

/**
 * GHashTable * secret_attributes_buildv (const SecretSchema *schema, va_list va);
 */
        var secret_attributes_build = secretLib.declare("secret_attributes_buildv",
        ctypes.default_abi,
        Type.GHashTable.ptr, /* return */
        Type.gpointer /* valist */);

/**
 * void gnome_keyring_attribute_list_free (GnomeKeyringAttributeList *attributes);
 * replaced by g_hash_table_unref()
 */
//        var gnome_keyring_attribute_list_free = secretLib.declare("gnome_keyring_attribute_list_free",
//                                                                  ctypes.default_abi,
//        ctypes.void_t, /* return */
//        Type.GnomeKeyringAttributeList.ptr /* attributes */);

/**
 * void gnome_keyring_attribute_list_append_string (GnomeKeyringAttributeList *attributes,
 *                                                  const char *name,
 *                                                  const char *value);
 *
 *replaced by secret_attributes_buildv
 */
 //       var gnome_keyring_attribute_list_append_string = secretLib.declare("gnome_keyring_attribute_list_append_string",
//                                                                           ctypes.default_abi,
//        ctypes.void_t, /* return */
//        Type.GnomeKeyringAttributeList.ptr, /* attributes */
//        Type.char.ptr, /* name */
//        Type.char.ptr /* value */);

/**
 * void gnome_keyring_attribute_list_append_uint32 (GnomeKeyringAttributeList *attributes,
 *                                                  const char *name,
 *                                                  guint32 value);
 *replaced by secret_attributes_buildv
 */
//        var gnome_keyring_attribute_list_append_uint32 = secretLib.declare("gnome_keyring_attribute_list_append_uint32",
//                                                                           ctypes.default_abi,
//        ctypes.void_t, /* return */
//        Type.GnomeKeyringAttributeList.ptr, /* attributes */
//        Type.char.ptr, /* name */
//        Type.guint32 /* value */);

/**
 * GList * secret_service_search_sync (SecretService *service,
                            const SecretSchema *schema,
                            GHashTable *attributes,
                            SecretSearchFlags flags,
                            GCancellable *cancellable,
                            GError **error);
 */
        var secret_service_search_sync = secretLib.declare("secret_service_search_sync",
                                                              ctypes.default_abi,
        Type.GList.ptr, /* return */
        Type.SecretService.ptr, /* service */
        Type.GHashTable.ptr, /* attributes */
        Type.SecretSearchFlags, /* flags */
        Type.GCancellable.ptr, /* cancellable */
        Type.GError.ptr.ptr /* error */);

/**
 * gboolean secret_item_load_secret_sync (SecretItem *self,
                              GCancellable *cancellable,
                              GError **error);
 */
        var secret_item_load_secret_sync = secretLib.declare("secret_item_load_secret_sync",
                                                            ctypes.default_abi,
        Type.gboolean, /* return */
        Type.SecretItem.ptr, /* self */
        Type.GCancellable.ptr, /* cancellable */
        Type.GError.ptr.ptr /* error */);

/**
 * gboolean secret_collection_get_locked (SecretCollection *self);
 */
        var secret_collection_get_locked = secretLib.declare("secret_collection_get_locked",
                                                                 ctypes.default_abi,
        Type.gboolean, /* return */
        Type.SecretCollection.ptr /* self */);

/**
 * GnomeKeyringResult gnome_keyring_item_delete_sync (const char *keyring,
 *                                                    guint32 id);
 */
//        var gnome_keyring_item_delete_sync = secretLib.declare("gnome_keyring_item_delete_sync",
//                                                               ctypes.default_abi,
//        Type.GnomeKeyringResult, /* return */
//        Type.char.ptr, /* keyring */
//        Type.guint32 /* id */);

/**
 * GnomeKeyringResult gnome_keyring_list_item_ids_sync (const char *keyring,
 *                                                      GList **ids);
 */
//        var gnome_keyring_list_item_ids_sync = secretLib.declare("gnome_keyring_list_item_ids_sync",
//                                                                 ctypes.default_abi,
//        Type.GnomeKeyringResult, /* return */
//        Type.char.ptr, /* keyring */
//        Type.GList.ptr.ptr /* ids*/);

/**
 * GnomeKeyringResult gnome_keyring_item_get_info_sync (const char *keyring,
 *                                                      guint32 id,
 *                                                      GnomeKeyringItemInfo **info);
 */
//        var gnome_keyring_item_get_info_sync = secretLib.declare("gnome_keyring_item_get_info_sync",
//                                                                 ctypes.default_abi,
//        Type.GnomeKeyringResult, /* return */
//        Type.char.ptr, /* keyring */
//        Type.guint32, /* id */
//        Type.GnomeKeyringItemInfo.ptr /* info */);

/**
 * GnomeKeyringItemType gnome_keyring_item_info_get_type (GnomeKeyringItemInfo *item_info);
 */
//        var gnome_keyring_item_info_get_type = secretLib.declare("gnome_keyring_item_info_get_type",
//                                                                 ctypes.default_abi,
//        Type.GnomeKeyringItemType, /* return */
//        Type.GnomeKeyringItemInfo /* item_info */);

/**
 * char * gnome_keyring_item_info_get_secret (GnomeKeyringItemInfo *item_info);
 */
//        var gnome_keyring_item_info_get_secret = secretLib.declare("gnome_keyring_item_info_get_secret",
//                                                                   ctypes.default_abi,
//        Type.char.ptr, /* return */
//        Type.GnomeKeyringItemInfo /* item_info */);

/**
 * char * gnome_keyring_item_info_get_display_name (GnomeKeyringItemInfo *item_info);
 */
//        var gnome_keyring_item_info_get_display_name = secretLib.declare("gnome_keyring_item_info_get_display_name",
//                                                                         ctypes.default_abi,
//        Type.char.ptr, /* return */
//        Type.GnomeKeyringItemInfo /* item_info */);

/**
 * GnomeKeyringResult gnome_keyring_item_get_attributes_sync
 *                                      (const char *keyring,
 *                                      guint32 id,
 *                                      GnomeKeyringAttributeList **attributes);
 */
  //      var gnome_keyring_item_get_attributes_sync = secretLib.declare("gnome_keyring_item_get_attributes_sync",
//                                                                       ctypes.default_abi,
//        Type.GnomeKeyringResult, /* return */
//        Type.char.ptr, /* keyring */
//        Type.guint32, /* id */
//        Type.GnomeKeyringAttributeList.ptr.ptr /* attributes */);

/**
 * const gchar * gnome_keyring_attribute_get_string (GnomeKeyringAttribute *attribute);
 */
  //      var gnome_keyring_attribute_get_string = secretLib.declare("gnome_keyring_attribute_get_string",
//                                                                   ctypes.default_abi,
//        Type.char.ptr, /* return */
//        Type.GnomeKeyringAttribute.ptr /* attribute*/);

/**
 * guint32 gnome_keyring_attribute_get_uint32 (GnomeKeyringAttribute *attribute);
 */
 //       var gnome_keyring_attribute_get_uint32 = secretLib.declare("gnome_keyring_attribute_get_uint32",
 //                                                                  ctypes.default_abi,
//        Type.guint32, /* return */
//        Type.GnomeKeyringAttribute.ptr /* attribute*/);

        getCollection = function(keyring) {
            let error = Type.GError.ptr();
            var collection = secret_collection_for_alias_sync (secret_service_get_sync(Values.SecretServiceFlags.SECRET_SERVICE_NONE, null,null )/*null*/,
                                                                keyring == null ? SECRET_COLLECTION_DEFAULT : keyring,
                                                                Values.SecretCollectionFlags.SECRET_COLLECTION_NONE,
                                                                Type.GCancellable.ptr(0),
                                                                error.address());
            if (error.address().isNull())
                throw "secret_collection_for_alias_sync failed: " + error.content.message;
            return collection;
        }

        create = function(keyring, password) {
            if(typeof password != "string")
                password = null;
            var error;
            var collection = secret_collection_create_sync(null, keyring, keyring, password);

            if(error != Values.Result.OK)
                throw "secret_collection_create_sync failed: " + error;
        };

        destroy = function(keyring) {
            var error = null;
            secret_collection_delete_sync (getCollection(keyring), null, error);
            if(error != null)
                throw "secret_collection_delete_sync failed: " + error.message;
        };

        unlock = function(keyring, password) {
            if(typeof password != "string")
                password = null;
            let error = Type.GError.ptr();
            var list = Type.GList.ptr(0);
            list = g_list_append(null, getCollection(keyring));
            secret_service_unlock_sync (null, list, null, null, error.address());
            g_list_free(list);

            if(error.address().isNull())
                throw "secret_service_unlock_sync failed: " + error.content.message;
        };

        lock = function(keyring) {
            var error = null;
            var list = Type.GList.ptr(0);
            list = g_list_append(null, getCollection(keyring));
            secret_service_lock_sync (null, list, null, null, error);
            g_list_free(list);

            if(error != null)
                throw "secret_service_lock_sync failed: " + error.message;
        };

        /*
        getInfo = function(keyring) {
            var info = Type.GnomeKeyringInfo(0);
            var error = gnome_keyring_get_info_sync(keyring, info.address());
            if(error != Values.Result.OK)
                throw "gnome_keyring_get_info_sync failed: " + error;

            return info;
        };*/

        isLocked = function(keyring) {
            return secret_collection_get_locked (getCollection(keyring));
        };

        /* FIXME really needed ?
        changePassword = function(keyring, oldPassword, newPassword) {
            var error = gnome_keyring_change_password_sync(keyring, oldPassword, newPassword);
            if(error != Values.Result.OK)
                throw "gnome_keyring_change_password_sync failed: " + error;
        };*/

       /* FIXME really needed ?
        getNames = function() {
            var list = Type.GList.ptr(0);
            var error = gnome_keyring_list_keyring_names_sync(list.address())
            if(error != Values.Result.OK)
                throw "gnome_keyring_list_keyring_names_sync failed: " + error;

            var names = [];
            while(!list.isNull()) {
                var name = ctypes.cast(list.contents.data, Type.char.ptr);
                names.push(name.readString());
                list = ctypes.cast(list.contents.next, Type.GList.ptr);
            }

            return names;
        };*/

        getItemIDs = function(keyring, list) {
            list = secret_collection_get_items (getCollection(keyring));
            return list;
/*
            var idsOut = [];
            while(!list.isNull()) {
                var itemptr = ctypes.cast(list.contents.data, Type.char.ptr);
                idsOut.push(ctypes.cast(itemptr, Type.SecretItem).value);
                list = ctypes.cast(list.contents.next, Type.GList.ptr);
            }

            return idsOut;*/
        };

        getItems = function(keyring) {
            var list = Type.GList.ptr();
            list = getItemIDs(keyring, list);

            var itemsOut = [];
            while(!list.isNull()) {
                var info = itemGetInfo(keyring, list.contents.data);
                var attributes = itemGetAttributes(keyring, list.contents.data);

                itemsOut.push({
                    id: null/*ids[i] FIXME*/,
                    displayName: info.displayName,
                    secret: info.secret,
                    type: info.type,
                    attributes: attributes,
                    toString: function() {
                        var str = this.id + ": " + this.displayName + ": \n" +
                            "  Password: " + this.secret + "\n" +
                            "  Type: " + this.type + "\n" +
                            "  Attributes:\n";
                        for(var key in this.attributes)
                            str += "    " + key + ": " + this.attributes[key] + "\n";
                        return str;
                    }
                });
                list = ctypes.cast(list.contents.next, Type.GList.ptr);
            }

            return itemsOut;
        };

        itemCreate = function(keyring, type, displayName, attributes, secret,
                              update_if_exists) {
            var attr = g_hash_table_new (ctypes.cast(g_str_hash,Type.GHashFunc.ptr), ctypes.cast(g_str_equal,Type.GEqualFunc.ptr));
            var error = null;

            if (attr == null)
                throw "g_hash_table_new failed";

            for(var k in attributes) {
                var key = ctypes.char.array()(k);
                var attribute = ctypes.jschar.ptr;
                attribute = attributes[k];
                g_hash_table_insert (attr, key, attribute);
            }

            var schema= null;

            if (type = ItemType.NOTE)
                schema = SECRET_SCHEMA_NOTE;


            secret_password_storev_sync (schema, attr, keyring, displayName, secret, null, error);
            if (error != null)
                throw "secret_password_storev_sync failed: " + error.message;

            g_hash_table_unref (attr);
            attr = null;

            return null;
        };

        itemDelete = function(keyring, id, attributes) {
            var attr = g_hash_table_new (g_str_hash, g_str_equal);
            var error = null;

            if (attr == null)
                throw "g_hash_table_new failed";

            for(var key in attributes) {
                g_hash_table_insert (attr, key, attributes[key]);
            }

            secret_password_clearv_sync (schema, attr, null, error);
            if(error != null)
                throw "secret_password_clearv_sync failed: " + error.message;
        };

        itemGetInfo = function(keyring, id) {
            var error = null;
            if (secret_item_load_secret_sync (id, null, error) == false)
               throw "secret_item_load_secret_sync failed: " + error.message;

            return {
                displayName: secret_item_get_label(self).readString(),
                secret: secret_value_get_text (secret_item_get_secret (self)).readString(),
                type: secret_item_get_schema_name(info)
            };
        };

        itemGetAttributes = function(keyring, id) {
            var schema = secret_item_get_schema (id)
            var attributes_hash_table = secret_item_get_attributes(id);
            var keys = g_hash_table_get_keys(attributes_hash_table);

            while(!keys.isNull()) {
                var key = keys.contents.data;
                value =  g_hash_table_lookup(attributes_hash_table, key).readString();
                /*
                if(array[i].type == Values.AttributeType.SECRET_SCHEMA_ATTRIBUTE_STRING)
                    value =  g_hash_table_lookup(attributes_hash_table, i).readString();
                else if(array[i].type == Values.AttributeType.SECRET_SCHEMA_ATTRIBUTE_INTEGER)
                    value = g_hash_table_lookup(attributes_hash_table, i);
                    */
                attributesOut[array[i].name.readString()] = value;
                keys = ctypes.cast(keys.contents.next, Type.GList.ptr);
            }
            return attributesOut;
        };

